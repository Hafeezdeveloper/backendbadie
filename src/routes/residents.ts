import express from "express";
import { prisma } from "../server.js";
import { ResidentUpdateSchema, PaginationSchema } from "../lib/validations.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrResident } from "@/lib/auth.middleware.js";

const router = express.Router();

// Get all residents (Admin only)
router.get(
  "/",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const query = PaginationSchema.parse(req.query);
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { apartment: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search, mode: "insensitive" } },
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

      const [residents, total] = await Promise.all([
        prisma.resident.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            name: true,
            apartment: true,
            phone: true,
            email: true,
            status: true,
            approvalStatus: true,
            familyMembers: true,
            joinDate: true,
            occupation: true,
            ownershipType: true,
            emergencyContact: true,
            emergencyContactPhone: true,
            createdAt: true,
            _count: {
              select: {
                vehicles: true,
                complaints: true,
                serviceBookings: true,
              },
            },
          },
        }),
        prisma.resident.count({ where }),
      ]);

      res.json({
        residents,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get residents error:", error);
      res.status(500).json({
        error: "Failed to fetch residents",
        message: "Internal server error",
      });
    }
  },
);

// Get resident by ID
router.get(
  "/:id",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const residentId = req.params.id;

      // Check if user can access this resident's data
      if (req.user!.type === "resident" && req.user!.id !== residentId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only access your own data",
        });
      }

      const resident = await prisma.resident.findUnique({
        where: { id: residentId },
        include: {
          vehicles: {
            select: {
              id: true,
              vehicleType: true,
              make: true,
              model: true,
              year: true,
              color: true,
              licensePlate: true,
              registrationDate: true,
            },
          },
          complaints: {
            select: {
              id: true,
              title: true,
              category: true,
              status: true,
              priority: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          serviceBookings: {
            select: {
              id: true,
              serviceCategory: true,
              status: true,
              scheduledDate: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          maintenanceBills: {
            select: {
              id: true,
              month: true,
              year: true,
              amount: true,
              status: true,
              dueDate: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });

      if (!resident) {
        return res.status(404).json({
          error: "Resident not found",
          message: "Resident does not exist",
        });
      }

      // Remove sensitive data for non-admin users
      if (req.user!.type !== "admin") {
        delete (resident as any).password;
      }

      res.json({ resident });
    } catch (error) {
      console.error("Get resident error:", error);
      res.status(500).json({
        error: "Failed to fetch resident",
        message: "Internal server error",
      });
    }
  },
);

// Update resident
router.patch(
  "/:id",
  async (req: AuthRequest, res) => {
    try {
      const residentId = req.params.id;
      const validatedData = ResidentUpdateSchema.parse(req.body);

      // Check if user can update this resident's data
      if (req.user!.type === "resident" && req.user!.id !== residentId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only update your own data",
        });
      }

      // Check if resident exists
      const existingResident = await prisma.resident.findUnique({
        where: { id: residentId },
      });

      if (!existingResident) {
        return res.status(404).json({
          error: "Resident not found",
          message: "Resident does not exist",
        });
      }

      // Check for duplicate email or apartment (if updating)
      if (validatedData.email || validatedData.apartment) {
        const duplicateWhere: any = {
          AND: [
            { id: { not: residentId } },
            {
              OR: [],
            },
          ],
        };

        if (validatedData.email) {
          duplicateWhere.AND[1].OR.push({ email: validatedData.email });
        }
        if (validatedData.apartment) {
          duplicateWhere.AND[1].OR.push({ apartment: validatedData.apartment });
        }

        const duplicate = await prisma.resident.findFirst({
          where: duplicateWhere,
        });

        if (duplicate) {
          return res.status(400).json({
            error: "Duplicate data",
            message:
              duplicate.email === validatedData.email
                ? "Email is already in use"
                : "Apartment is already registered",
          });
        }
      }

      // Update resident
      const updatedResident = await prisma.resident.update({
        where: { id: residentId },
        data: validatedData,
        select: {
          id: true,
          name: true,
          apartment: true,
          phone: true,
          email: true,
          status: true,
          approvalStatus: true,
          familyMembers: true,
          joinDate: true,
          occupation: true,
          ownershipType: true,
          emergencyContact: true,
          emergencyContactPhone: true,
          idDocumentType: true,
          cnicNumber: true,
          passportNumber: true,
          driverLicenseNumber: true,
          profilePhoto: true,
          updatedAt: true,
        },
      });

      res.json({
        message: "Resident updated successfully",
        resident: updatedResident,
      });
    } catch (error) {
      console.error("Update resident error:", error);
      res.status(400).json({
        error: "Failed to update resident",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Approve/Reject resident (Admin only)
router.patch(
  "/:id/approval",
  async (req: AuthRequest, res) => {
    try {
      const residentId = req.params.id;
      const { approvalStatus, status } = req.body;

      if (!["APPROVED", "REJECTED"].includes(approvalStatus)) {
        return res.status(400).json({
          error: "Invalid approval status",
          message: "Approval status must be APPROVED or REJECTED",
        });
      }

      const updatedResident = await prisma.resident.update({
        where: { id: residentId },
        data: {
          approvalStatus,
          status: approvalStatus === "APPROVED" ? "Active" : "Rejected",
        },
        select: {
          id: true,
          name: true,
          apartment: true,
          email: true,
          status: true,
          approvalStatus: true,
        },
      });

      res.json({
        message: `Resident ${approvalStatus.toLowerCase()} successfully`,
        resident: updatedResident,
      });
    } catch (error) {
      console.error("Approve resident error:", error);
      res.status(500).json({
        error: "Failed to update approval status",
        message: "Internal server error",
      });
    }
  },
);

// Delete resident (Admin only)
router.delete(
  "/:id",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const residentId = req.params.id;

      // Check if resident exists
      const resident = await prisma.resident.findUnique({
        where: { id: residentId },
      });

      if (!resident) {
        return res.status(404).json({
          error: "Resident not found",
          message: "Resident does not exist",
        });
      }

      // Delete resident (cascade will handle related records)
      await prisma.resident.delete({
        where: { id: residentId },
      });

      res.json({
        message: "Resident deleted successfully",
      });
    } catch (error) {
      console.error("Delete resident error:", error);
      res.status(500).json({
        error: "Failed to delete resident",
        message: "Internal server error",
      });
    }
  },
);

// Get resident statistics (Admin only)
router.get(
  "/stats/overview",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [
        totalResidents,
        activeResidents,
        pendingApprovals,
        totalVehicles,
        totalComplaints,
        openComplaints,
      ] = await Promise.all([
        prisma.resident.count(),
        prisma.resident.count({
          where: { status: "Active", approvalStatus: "APPROVED" },
        }),
        prisma.resident.count({ where: { approvalStatus: "PENDING" } }),
        prisma.vehicle.count(),
        prisma.complaint.count(),
        prisma.complaint.count({ where: { status: "OPEN" } }),
      ]);

      const recentRegistrations = await prisma.resident.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { id: true, name: true, apartment: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      res.json({
        statistics: {
          totalResidents,
          activeResidents,
          pendingApprovals,
          totalVehicles,
          totalComplaints,
          openComplaints,
        },
        recentRegistrations,
      });
    } catch (error) {
      console.error("Get resident stats error:", error);
      res.status(500).json({
        error: "Failed to fetch statistics",
        message: "Internal server error",
      });
    }
  },
);

export default router;
