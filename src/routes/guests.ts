import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrResident, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

import {
  GuestRegistrationSchema,
  PaginationSchema,
} from "../lib/validations.js";

const router = express.Router();

// Get all guests (Admin) or resident's guests (Resident)
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const query = PaginationSchema.parse(req.query);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause based on user type
    const where: any = {};
    if (req.user!.type === "resident") {
      where.residentId = req.user!.id;
    }

    if (query.search) {
      where.OR = [
        { guestName: { contains: query.search, mode: "insensitive" } },
        { purpose: { contains: query.search, mode: "insensitive" } },
        { phone: { contains: query.search, mode: "insensitive" } },
        ...(req.user!.type === "admin"
          ? [
              {
                resident: {
                  OR: [
                    { name: { contains: query.search, mode: "insensitive" } },
                    {
                      apartment: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            ]
          : []),
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    // Build order clause
    const orderBy: any = {};
    if (query.sort) {
      orderBy[query.sort] = query.order || "asc";
    } else {
      orderBy.createdAt = "desc";
    }

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          resident: {
            select: {
              id: true,
              name: true,
              apartment: true,
              phone: true,
            },
          },
        },
      }),
      prisma.guest.count({ where }),
    ]);

    res.json({
      guests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get guests error:", error);
    res.status(500).json({
      error: "Failed to fetch guests",
      message: "Internal server error",
    });
  }
});

// Get guest by ID
router.get("/:id", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const guestId = req.params.id;

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        resident: {
          select: {
            id: true,
            name: true,
            apartment: true,
            phone: true,
            email: true,
          },
        },
      },
    });

    if (!guest) {
      return res.status(404).json({
        error: "Guest not found",
        message: "Guest does not exist",
      });
    }

    // Check if resident can access this guest
    if (req.user!.type === "resident" && guest.residentId !== req.user!.id) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own guests",
      });
    }

    res.json({ guest });
  } catch (error) {
    console.error("Get guest error:", error);
    res.status(500).json({
      error: "Failed to fetch guest",
      message: "Internal server error",
    });
  }
});

// Register new guest (Resident only)
router.post(
  "/",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const validatedData = GuestRegistrationSchema.parse(req.body);
      const residentId = req.user!.id;

      // If admin is creating, they should specify residentId
      let targetResidentId = residentId;
      if (req.user!.type === "admin" && req.body.residentId) {
        targetResidentId = req.body.residentId;
      } else if (req.user!.type !== "resident") {
        return res.status(400).json({
          error: "Resident ID required",
          message: "Admin must specify residentId when creating guests",
        });
      }

      // Get resident details
      const resident = await prisma.resident.findUnique({
        where: { id: targetResidentId },
        select: { id: true, name: true, apartment: true },
      });

      if (!resident) {
        return res.status(404).json({
          error: "Resident not found",
          message: "Resident does not exist",
        });
      }

      // Validate visit times
      const visitDate = new Date(validatedData.visitDate);
      const now = new Date();

      if (visitDate < now) {
        return res.status(400).json({
          error: "Invalid visit date",
          message: "Visit date cannot be in the past",
        });
      }

      // Generate QR code data
      const qrData = {
        type: "guest_entry",
        guestId: `G${Date.now()}`,
        guestName: validatedData.guestName,
        hostApartment: resident.apartment,
        hostName: resident.name,
        purpose: validatedData.purpose,
        vehicleType: validatedData.vehicleType || "None",
        licensePlate: validatedData.licensePlate || "",
        validFrom: `${validatedData.visitDate}T${validatedData.timeFrom}:00`,
        validUntil: `${validatedData.visitDate}T${validatedData.timeTo}:00`,
        idNumber: validatedData.idNumber,
        idType: validatedData.idType,
        phone: validatedData.phone,
      };

      // Create guest
      const guest = await prisma.guest.create({
        data: {
          residentId: targetResidentId,
          guestName: validatedData.guestName,
          purpose: validatedData.purpose,
          visitDate: new Date(validatedData.visitDate),
          timeFrom: validatedData.timeFrom,
          timeTo: validatedData.timeTo,
          vehicleType: validatedData.vehicleType,
          licensePlate: validatedData.licensePlate,
          idNumber: validatedData.idNumber,
          idType: validatedData.idType,
          phone: validatedData.phone,
          qrCode: JSON.stringify(qrData),
          status: "ACTIVE",
        },
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
        },
      });

      res.status(201).json({
        message: "Guest registered successfully",
        guest,
        qrCode: JSON.stringify(qrData),
      });
    } catch (error) {
      console.error("Register guest error:", error);
      res.status(400).json({
        error: "Failed to register guest",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Update guest status
router.patch(
  "/:id/status",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const guestId = req.params.id;
      const { status } = req.body;

      if (!["ACTIVE", "EXPIRED", "CANCELLED"].includes(status)) {
        return res.status(400).json({
          error: "Invalid status",
          message: "Status must be ACTIVE, EXPIRED, or CANCELLED",
        });
      }

      const guest = await prisma.guest.findUnique({
        where: { id: guestId },
      });

      if (!guest) {
        return res.status(404).json({
          error: "Guest not found",
          message: "Guest does not exist",
        });
      }

      // Check if resident can update this guest
      if (req.user!.type === "resident" && guest.residentId !== req.user!.id) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only update your own guests",
        });
      }

      const updatedGuest = await prisma.guest.update({
        where: { id: guestId },
        data: { status },
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
        },
      });

      res.json({
        message: `Guest status updated to ${status.toLowerCase()}`,
        guest: updatedGuest,
      });
    } catch (error) {
      console.error("Update guest status error:", error);
      res.status(500).json({
        error: "Failed to update guest status",
        message: "Internal server error",
      });
    }
  },
);

// Get guest's QR code
router.get(
  "/:id/qr-code",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const guestId = req.params.id;

      const guest = await prisma.guest.findUnique({
        where: { id: guestId },
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
        },
      });

      if (!guest) {
        return res.status(404).json({
          error: "Guest not found",
          message: "Guest does not exist",
        });
      }

      // Check if resident can access this guest's QR code
      if (req.user!.type === "resident" && guest.residentId !== req.user!.id) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only access your own guests' QR codes",
        });
      }

      res.json({
        qrCode: guest.qrCode,
        guest: {
          id: guest.id,
          guestName: guest.guestName,
          purpose: guest.purpose,
          visitDate: guest.visitDate,
          timeFrom: guest.timeFrom,
          timeTo: guest.timeTo,
          resident: guest.resident,
        },
      });
    } catch (error) {
      console.error("Get guest QR code error:", error);
      res.status(500).json({
        error: "Failed to get QR code",
        message: "Internal server error",
      });
    }
  },
);

// Get resident's guests
router.get(
  "/resident/:residentId",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const residentId = parseInt(req.params.residentId);

      // Check if resident can access these guests
      if (req.user!.type === "resident" && req.user!.id !== residentId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only access your own guests",
        });
      }

      const guests = await prisma.guest.findMany({
        where: { residentId },
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Separate guests by status
      const activeGuests = guests.filter((g) => g.status === "ACTIVE");
      const expiredGuests = guests.filter((g) => g.status === "EXPIRED");
      const cancelledGuests = guests.filter((g) => g.status === "CANCELLED");

      // Check for automatically expired guests (past visit date)
      const now = new Date();
      const autoExpiredGuests = activeGuests.filter((guest) => {
        const visitEndTime = new Date(
          `${guest.visitDate.toISOString().split("T")[0]}T${guest.timeTo}:00`,
        );
        return visitEndTime < now;
      });

      // Update auto-expired guests
      if (autoExpiredGuests.length > 0) {
        await prisma.guest.updateMany({
          where: {
            id: { in: autoExpiredGuests.map((g) => g.id) },
          },
          data: { status: "EXPIRED" },
        });
      }

      res.json({
        guests,
        statistics: {
          total: guests.length,
          active: activeGuests.length - autoExpiredGuests.length,
          expired: expiredGuests.length + autoExpiredGuests.length,
          cancelled: cancelledGuests.length,
        },
      });
    } catch (error) {
      console.error("Get resident guests error:", error);
      res.status(500).json({
        error: "Failed to fetch guests",
        message: "Internal server error",
      });
    }
  },
);

// Delete guest
router.delete(
  "/:id",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const guestId = req.params.id;

      const guest = await prisma.guest.findUnique({
        where: { id: guestId },
      });

      if (!guest) {
        return res.status(404).json({
          error: "Guest not found",
          message: "Guest does not exist",
        });
      }

      // Check if resident can delete this guest
      if (req.user!.type === "resident" && guest.residentId !== req.user!.id) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only delete your own guests",
        });
      }

      await prisma.guest.delete({
        where: { id: guestId },
      });

      res.json({
        message: "Guest deleted successfully",
      });
    } catch (error) {
      console.error("Delete guest error:", error);
      res.status(500).json({
        error: "Failed to delete guest",
        message: "Internal server error",
      });
    }
  },
);

// Get guest statistics (Admin only)
router.get(
  "/stats/overview",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [totalGuests, activeGuests, expiredGuests, cancelledGuests] =
        await Promise.all([
          prisma.guest.count(),
          prisma.guest.count({ where: { status: "ACTIVE" } }),
          prisma.guest.count({ where: { status: "EXPIRED" } }),
          prisma.guest.count({ where: { status: "CANCELLED" } }),
        ]);

      const todayGuests = await prisma.guest.count({
        where: {
          visitDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999)),
          },
        },
      });

      const recentGuests = await prisma.guest.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          resident: { select: { name: true, apartment: true } },
        },
      });

      res.json({
        statistics: {
          totalGuests,
          activeGuests,
          expiredGuests,
          cancelledGuests,
          todayGuests,
        },
        recentGuests,
      });
    } catch (error) {
      console.error("Get guest stats error:", error);
      res.status(500).json({
        error: "Failed to fetch statistics",
        message: "Internal server error",
      });
    }
  },
);

export default router;
