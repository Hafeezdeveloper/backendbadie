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
// Add complaint with voice note
// Add complaint with voice note
router.post(
  "/complaints",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const { title, category, description, priority, images, voiceNote, compalainText } = req.body;
      const residentId = req.user!.id;
      console.log(req.user.id)
      // Validate input
      if (!title || !category || !description) {
        return res.status(400).json({
          error: "Missing required fields",
          message: "Title, category, and description are required"
        });
      }

      // Create complaint - using UserComplaint model
      const complaint = await prisma.userComplaint.create({
        data: {
          title,
          category,
          description,
          priority: priority ? priority.toLowerCase() : "medium",
          complaintText: compalainText || "",
          status: "open",
          residentId: residentId // Directly provide the ID
        },
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          complaintText: true,
          priority: true,
          createdAt: true,
          residentId: true,
          updatedAt: true
        }
      });

      res.status(201).json({
        message: "Complaint submitted successfully",
        complaint
      });
    } catch (error) {
      console.error("Create complaint error:", error);
      res.status(500).json({
        error: "Failed to submit complaint",
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  }
);
router.post(
  "/complaints",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const { title, category, description, priority, images, voiceNote, complaintText } = req.body;
      const residentId = req.user!.id;

      // Validate input
      if (!title || !category || !description) {
        return res.status(400).json({
          error: "Missing required fields",
          message: "Title, category, and description are required"
        });
      }

      // Create complaint
      const complaint = await prisma.userComplaint.create({
        data: {
          title,
          category,
          description,
          priority: priority ? priority.toLowerCase() : "medium",
          complaintText: complaintText || "",
          status: "open",
          residentId: residentId
        },
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
          complaintText: true,
          priority: true,
          createdAt: true,
          residentId: true,
          updatedAt: true
        }
      });

      res.status(201).json({
        message: "Complaint submitted successfully",
        complaint
      });
    } catch (error) {
      console.error("Create complaint error:", error);
      res.status(500).json({
        error: "Failed to submit complaint",
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  }
);

// GET - Fetch complaints (with filters and pagination)
router.get(
  "/complaints/all",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const { search, status, category, page = 1, limit = 10 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
          { complaintText: { contains: search as string, mode: "insensitive" } }
        ];
      }
      if (status) {
        where.status = status;
      }
      if (category) {
        where.category = category;
      }

      const [complaints, total] = await Promise.all([
        prisma.userComplaint.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            category: true,
            status: true,
            complaintText: true,
            description: true,
            priority: true,
            createdAt: true,
            updatedAt: true,
            residentId: true, // We’ll use this to manually fetch resident info
          }
        }),
        prisma.userComplaint.count({ where })
      ]);

      // Get all unique residentIds from the complaints
      const residentIds = [...new Set(complaints.map(c => c.residentId))];

      // Fetch resident data in one go
      const residents = await prisma.resident.findMany({
        where: { id: { in: residentIds } },
        select: {
          id: true,
          name: true,
          apartment: true,
        }
      });

      // Attach resident info manually
      const complaintsWithResident = complaints.map(complaint => {
        const resident = residents.find(r => r.id === complaint.residentId);
        return {
          ...complaint,
          resident: resident || null
        };
      });

      res.json({
        complaints: complaintsWithResident,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error("Get complaints error:", error);
      res.status(500).json({
        error: "Failed to fetch complaints",
        message: error instanceof Error ? error.message : "Internal server error"
      });
    }
  }
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
