import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

import { GateEntrySchema, PaginationSchema } from "../lib/validations.js";

const router = express.Router();

// Get all gate entries (Admin only)
router.get(
  "/",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const query = PaginationSchema.parse(req.query);
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (query.search) {
        where.OR = [
          { person: { contains: query.search, mode: "insensitive" } },
          { apartment: { contains: query.search, mode: "insensitive" } },
          { entryType: { contains: query.search, mode: "insensitive" } },
          { vehicle: { contains: query.search, mode: "insensitive" } },
        ];
      }

      // Build order clause
      const orderBy: any = {};
      if (query.sort) {
        orderBy[query.sort] = query.order || "desc";
      } else {
        orderBy.createdAt = "desc";
      }

      const [entries, total] = await Promise.all([
        prisma.gateEntry.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            resident: {
              select: { name: true, apartment: true },
            },
          },
        }),
        prisma.gateEntry.count({ where }),
      ]);

      res.json({
        entries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get gate entries error:", error);
      res.status(500).json({
        error: "Failed to fetch gate entries",
        message: "Internal server error",
      });
    }
  },
);

// Create gate entry from QR scan (Admin only)
router.post(
  "/qr-scan",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({
          error: "Missing QR data",
          message: "QR code data is required",
        });
      }

      let parsedData;
      try {
        parsedData = JSON.parse(qrData);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid QR code",
          message: "QR code data is not valid JSON",
        });
      }

      const { type } = parsedData;
      const now = new Date();

      let entryData: any = {
        gate: "Main Gate",
        method: "QR Code",
      };

      // Handle different QR code types
      switch (type) {
        case "guest_entry":
          // Validate guest QR code
          const validFrom = new Date(parsedData.validFrom);
          const validUntil = new Date(parsedData.validUntil);

          if (now < validFrom || now > validUntil) {
            return res.status(400).json({
              error: "QR Code expired",
              message: "Guest QR code is not valid at this time",
            });
          }

          // Find the last entry for this guest
          const lastGuestEntry = await prisma.gateEntry.findFirst({
            where: {
              person: parsedData.guestName,
              apartment: parsedData.hostApartment,
              entryType: "Guest",
            },
            orderBy: { createdAt: "desc" },
          });

          const isGuestEntry =
            !lastGuestEntry || lastGuestEntry.type === "EXIT";

          entryData = {
            ...entryData,
            type: isGuestEntry ? "ENTRY" : "EXIT",
            person: parsedData.guestName,
            apartment: parsedData.hostApartment,
            entryType: "Guest",
            vehicle: parsedData.licensePlate
              ? `${parsedData.vehicleType} (${parsedData.licensePlate})`
              : parsedData.vehicleType || "None",
          };

          // Find resident ID for the host
          const hostResident = await prisma.resident.findFirst({
            where: { apartment: parsedData.hostApartment },
          });

          if (hostResident) {
            entryData.residentId = hostResident.id;
          }

          break;

        case "resident_entry":
          // Find the last entry for this resident
          const lastResidentEntry = await prisma.gateEntry.findFirst({
            where: {
              person: parsedData.residentName,
              apartment: parsedData.apartment,
              entryType: "Resident",
            },
            orderBy: { createdAt: "desc" },
          });

          const isResidentEntry =
            !lastResidentEntry || lastResidentEntry.type === "EXIT";

          entryData = {
            ...entryData,
            type: isResidentEntry ? "ENTRY" : "EXIT",
            person: parsedData.residentName,
            apartment: parsedData.apartment,
            entryType: "Resident",
            vehicle: "None",
            residentId: parsedData.residentId,
          };

          break;

        case "vehicle_entry":
          // Find the last entry for this vehicle
          const vehicleDescription = `${parsedData.make} ${parsedData.model} (${parsedData.licensePlate})`;
          const lastVehicleEntry = await prisma.gateEntry.findFirst({
            where: {
              person: parsedData.residentName,
              apartment: parsedData.apartment,
              vehicle: vehicleDescription,
              entryType: "Resident Vehicle",
            },
            orderBy: { createdAt: "desc" },
          });

          const isVehicleEntry =
            !lastVehicleEntry || lastVehicleEntry.type === "EXIT";

          entryData = {
            ...entryData,
            type: isVehicleEntry ? "ENTRY" : "EXIT",
            person: parsedData.residentName,
            apartment: parsedData.apartment,
            entryType: "Resident Vehicle",
            vehicle: vehicleDescription,
            residentId: parsedData.residentId,
          };

          break;

        case "delivery_entry":
          // Find the last entry for this delivery person
          const lastDeliveryEntry = await prisma.gateEntry.findFirst({
            where: {
              person: parsedData.riderName,
              apartment: parsedData.apartment,
              entryType: "Delivery",
            },
            orderBy: { createdAt: "desc" },
          });

          const isDeliveryEntry =
            !lastDeliveryEntry || lastDeliveryEntry.type === "EXIT";

          entryData = {
            ...entryData,
            type: isDeliveryEntry ? "ENTRY" : "EXIT",
            person: parsedData.riderName,
            apartment: parsedData.apartment,
            entryType: "Delivery",
            vehicle: parsedData.companyName || "Delivery Vehicle",
            residentId: parsedData.residentId,
          };

          break;

        case "service_provider_entry":
          // Find the last entry for this service provider
          const lastProviderEntry = await prisma.gateEntry.findFirst({
            where: {
              person: parsedData.providerName,
              entryType: "Service Provider",
            },
            orderBy: { createdAt: "desc" },
          });

          const isProviderEntry =
            !lastProviderEntry || lastProviderEntry.type === "EXIT";

          entryData = {
            ...entryData,
            type: isProviderEntry ? "ENTRY" : "EXIT",
            person: parsedData.providerName,
            apartment: "Service Provider",
            entryType: "Service Provider",
            vehicle: "None",
          };

          break;

        case "employee_entry":
          // Find the last entry for this employee
          const lastEmployeeEntry = await prisma.gateEntry.findFirst({
            where: {
              person: parsedData.employeeName,
              entryType: "Employee",
            },
            orderBy: { createdAt: "desc" },
          });

          const isEmployeeEntry =
            !lastEmployeeEntry || lastEmployeeEntry.type === "EXIT";

          entryData = {
            ...entryData,
            type: isEmployeeEntry ? "ENTRY" : "EXIT",
            person: parsedData.employeeName,
            apartment: parsedData.department,
            entryType: "Employee",
            vehicle: "None",
          };

          break;

        default:
          return res.status(400).json({
            error: "Invalid QR code type",
            message: `Unknown QR code type: ${type}`,
          });
      }

      // Create the gate entry
      const gateEntry = await prisma.gateEntry.create({
        data: entryData,
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
        },
      });

      res.status(201).json({
        message: `${entryData.type.toLowerCase()} recorded successfully`,
        entry: gateEntry,
        entryType: entryData.type,
        person: entryData.person,
        apartment: entryData.apartment,
      });
    } catch (error) {
      console.error("QR scan gate entry error:", error);
      res.status(500).json({
        error: "Failed to process QR code",
        message: "Internal server error",
      });
    }
  },
);

// Manual gate entry creation (Admin only)
router.post(
  "/",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const validatedData = GateEntrySchema.parse(req.body);

      const gateEntry = await prisma.gateEntry.create({
        data: validatedData,
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
        },
      });

      res.status(201).json({
        message: "Gate entry created successfully",
        entry: gateEntry,
      });
    } catch (error) {
      console.error("Create gate entry error:", error);
      res.status(400).json({
        error: "Failed to create gate entry",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Get today's statistics (Admin only)
router.get(
  "/stats/today",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [totalEntries, totalExits, guestEntries, vehicleEntries] =
        await Promise.all([
          prisma.gateEntry.count({
            where: {
              type: "ENTRY",
              createdAt: { gte: today, lt: tomorrow },
            },
          }),
          prisma.gateEntry.count({
            where: {
              type: "EXIT",
              createdAt: { gte: today, lt: tomorrow },
            },
          }),
          prisma.gateEntry.count({
            where: {
              entryType: "Guest",
              createdAt: { gte: today, lt: tomorrow },
            },
          }),
          prisma.gateEntry.count({
            where: {
              entryType: { in: ["Resident Vehicle", "Service Provider"] },
              createdAt: { gte: today, lt: tomorrow },
            },
          }),
        ]);

      const currentOccupancy = Math.max(0, totalEntries - totalExits);

      const entryTypeStats = await prisma.gateEntry.groupBy({
        by: ["entryType"],
        _count: { entryType: true },
        where: {
          createdAt: { gte: today, lt: tomorrow },
        },
      });

      res.json({
        statistics: {
          totalEntries,
          totalExits,
          currentOccupancy,
          guestEntries,
          vehicleEntries,
        },
        entryTypeStats,
      });
    } catch (error) {
      console.error("Get gate entry stats error:", error);
      res.status(500).json({
        error: "Failed to fetch statistics",
        message: "Internal server error",
      });
    }
  },
);

// Delete gate entry (Admin only)
router.delete(
  "/:id",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const entryId = req.params.id;

      const entry = await prisma.gateEntry.findUnique({
        where: { id: entryId },
      });

      if (!entry) {
        return res.status(404).json({
          error: "Gate entry not found",
          message: "Gate entry does not exist",
        });
      }

      await prisma.gateEntry.delete({
        where: { id: entryId },
      });

      res.json({
        message: "Gate entry deleted successfully",
      });
    } catch (error) {
      console.error("Delete gate entry error:", error);
      res.status(500).json({
        error: "Failed to delete gate entry",
        message: "Internal server error",
      });
    }
  },
);

export default router;
