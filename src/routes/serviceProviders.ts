import express from "express";
import { prisma } from "../server.js";

import {
  ServiceProviderUpdateSchema,
  PaginationSchema,
} from "../lib/validations.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

const router = express.Router();

// Get all service providers
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
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
        { serviceCategory: { contains: query.search, mode: "insensitive" } },
        { serviceArea: { contains: query.search, mode: "insensitive" } },
      ];
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.category) {
      where.serviceCategory = { contains: query.category, mode: "insensitive" };
    }

    // Build order clause
    const orderBy: any = {};
    if (query.sort) {
      orderBy[query.sort] = query.order || "asc";
    } else {
      orderBy.createdAt = "desc";
    }

    const [serviceProviders, total] = await Promise.all([
      prisma.serviceProvider.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          serviceCategory: true,
          serviceArea: true,
          status: true,
          rating: true,
          totalReviews: true,
          completedJobs: true,
          registrationDate: true,
          shortIntro: true,
          availability: true,
          _count: {
            select: {
              vehicles: true,
              serviceBookings: true,
              serviceReviews: true,
            },
          },
        },
      }),
      prisma.serviceProvider.count({ where }),
    ]);

    res.json({
      serviceProviders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get service providers error:", error);
    res.status(500).json({
      error: "Failed to fetch service providers",
      message: "Internal server error",
    });
  }
});

// Get service provider by ID
router.get("/:id", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const serviceProviderId = req.params.id;

    // Check if user can access this service provider's data
    if (
      req.user!.type === "serviceProvider" &&
      req.user!.id !== serviceProviderId
    ) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own data",
      });
    }

    const serviceProvider = await prisma.serviceProvider.findUnique({
      where: { id: serviceProviderId },
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
        serviceBookings: {
          select: {
            id: true,
            residentName: true,
            serviceCategory: true,
            status: true,
            scheduledDate: true,
            actualCost: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        serviceReviews: {
          select: {
            id: true,
            rating: true,
            review: true,
            reviewDate: true,
            resident: {
              select: { name: true, apartment: true },
            },
          },
          orderBy: { reviewDate: "desc" },
          take: 5,
        },
      },
    });

    if (!serviceProvider) {
      return res.status(404).json({
        error: "Service provider not found",
        message: "Service provider does not exist",
      });
    }

    // Remove sensitive data for non-admin users
    if (req.user!.type !== "admin") {
      delete (serviceProvider as any).password;
    }

    res.json({ serviceProvider });
  } catch (error) {
    console.error("Get service provider error:", error);
    res.status(500).json({
      error: "Failed to fetch service provider",
      message: "Internal server error",
    });
  }
});

// Update service provider
router.patch(
  "/:id",
  authenticateAndVerify,
  requireAdminOrServiceProvider,
  async (req: AuthRequest, res) => {
    try {
      const serviceProviderId = req.params.id;
      const validatedData = ServiceProviderUpdateSchema.parse(req.body);

      // Check if user can update this service provider's data
      if (
        req.user!.type === "serviceProvider" &&
        req.user!.id !== serviceProviderId
      ) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only update your own data",
        });
      }

      // Check if service provider exists
      const existingProvider = await prisma.serviceProvider.findUnique({
        where: { id: serviceProviderId },
      });

      if (!existingProvider) {
        return res.status(404).json({
          error: "Service provider not found",
          message: "Service provider does not exist",
        });
      }

      // Check for duplicate email or username (if updating)
      if (validatedData.email || validatedData.username) {
        const duplicateWhere: any = {
          AND: [
            { id: { not: serviceProviderId } },
            {
              OR: [],
            },
          ],
        };

        if (validatedData.email) {
          duplicateWhere.AND[1].OR.push({ email: validatedData.email });
        }
        if (validatedData.username) {
          duplicateWhere.AND[1].OR.push({ username: validatedData.username });
        }

        const duplicate = await prisma.serviceProvider.findFirst({
          where: duplicateWhere,
        });

        if (duplicate) {
          return res.status(400).json({
            error: "Duplicate data",
            message:
              duplicate.email === validatedData.email
                ? "Email is already in use"
                : "Username is already taken",
          });
        }
      }

      // Update service provider
      const updatedProvider = await prisma.serviceProvider.update({
        where: { id: serviceProviderId },
        data: validatedData,
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          serviceCategory: true,
          serviceArea: true,
          status: true,
          rating: true,
          totalReviews: true,
          completedJobs: true,
          shortIntro: true,
          experience: true,
          availability: true,
          updatedAt: true,
        },
      });

      res.json({
        message: "Service provider updated successfully",
        serviceProvider: updatedProvider,
      });
    } catch (error) {
      console.error("Update service provider error:", error);
      res.status(400).json({
        error: "Failed to update service provider",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Approve/Reject service provider (Admin only)
router.patch(
  "/:id/approval",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const serviceProviderId = req.params.id;
      const { status } = req.body;

      if (!["ACTIVE", "REJECTED", "SUSPENDED"].includes(status)) {
        return res.status(400).json({
          error: "Invalid status",
          message: "Status must be ACTIVE, REJECTED, or SUSPENDED",
        });
      }

      const updatedProvider = await prisma.serviceProvider.update({
        where: { id: serviceProviderId },
        data: { status },
        select: {
          id: true,
          name: true,
          email: true,
          serviceCategory: true,
          status: true,
        },
      });

      res.json({
        message: `Service provider status updated to ${status.toLowerCase()}`,
        serviceProvider: updatedProvider,
      });
    } catch (error) {
      console.error("Update service provider status error:", error);
      res.status(500).json({
        error: "Failed to update status",
        message: "Internal server error",
      });
    }
  },
);

// Get service provider's bookings
router.get(
  "/:id/bookings",
  authenticateAndVerify,
  requireAdminOrServiceProvider,
  async (req: AuthRequest, res) => {
    try {
      const serviceProviderId = req.params.id;
      const query = PaginationSchema.parse(req.query);

      // Check permissions
      if (
        req.user!.type === "serviceProvider" &&
        req.user!.id !== serviceProviderId
      ) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only access your own bookings",
        });
      }

      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = { serviceProviderId };
      if (query.status) {
        where.status = query.status;
      }

      const [bookings, total] = await Promise.all([
        prisma.serviceBooking.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            resident: {
              select: { name: true, apartment: true, phone: true },
            },
          },
        }),
        prisma.serviceBooking.count({ where }),
      ]);

      res.json({
        bookings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get service provider bookings error:", error);
      res.status(500).json({
        error: "Failed to fetch bookings",
        message: "Internal server error",
      });
    }
  },
);

// Get service categories
router.get("/categories/list", async (req: AuthRequest, res) => {
  try {
    const categories = await prisma.serviceProvider.findMany({
      select: { serviceCategory: true },
      distinct: ["serviceCategory"],
      where: { status: "ACTIVE" },
    });

    const categoryList = categories.map((cat) => cat.serviceCategory);

    res.json({ categories: categoryList });
  } catch (error) {
    console.error("Get service categories error:", error);
    res.status(500).json({
      error: "Failed to fetch categories",
      message: "Internal server error",
    });
  }
});

// Delete service provider (Admin only)
router.delete(
  "/:id",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const serviceProviderId = req.params.id;

      // Check if service provider exists
      const serviceProvider = await prisma.serviceProvider.findUnique({
        where: { id: serviceProviderId },
      });

      if (!serviceProvider) {
        return res.status(404).json({
          error: "Service provider not found",
          message: "Service provider does not exist",
        });
      }

      // Delete service provider (cascade will handle related records)
      await prisma.serviceProvider.delete({
        where: { id: serviceProviderId },
      });

      res.json({
        message: "Service provider deleted successfully",
      });
    } catch (error) {
      console.error("Delete service provider error:", error);
      res.status(500).json({
        error: "Failed to delete service provider",
        message: "Internal server error",
      });
    }
  },
);

export default router;
