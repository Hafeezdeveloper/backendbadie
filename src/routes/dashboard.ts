import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider, requireAdminOrResident } from "@/lib/auth.middleware.js";


const router = express.Router();

// Get admin dashboard statistics
router.get(
  "/admin/stats",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [
        totalResidents,
        activeResidents,
        pendingApprovals,
        totalServiceProviders,
        activeServiceProviders,
        pendingProviders,
        totalEmployees,
        activeEmployees,
        totalComplaints,
        openComplaints,
        inProgressComplaints,
        resolvedComplaints,
        todayGateEntries,
        totalVehicles,
        totalMaintenanceBills,
        pendingBills,
        paidBills,
        overdueBills,
        todayBookings,
        pendingBookings,
        completedBookings,
      ] = await Promise.all([
        // Residents
        prisma.resident.count(),
        prisma.resident.count({
          where: { status: "Active", approvalStatus: "APPROVED" },
        }),
        prisma.resident.count({ where: { approvalStatus: "PENDING" } }),

        // Service Providers
        prisma.serviceProvider.count(),
        prisma.serviceProvider.count({ where: { status: "ACTIVE" } }),
        prisma.serviceProvider.count({ where: { status: "PENDING" } }),

        // Employees
        prisma.employee.count(),
        prisma.employee.count({ where: { status: "ACTIVE" } }),

        // Complaints
        prisma.complaint.count(),
        prisma.complaint.count({ where: { status: "OPEN" } }),
        prisma.complaint.count({ where: { status: "IN_PROGRESS" } }),
        prisma.complaint.count({ where: { status: "RESOLVED" } }),

        // Gate Entries
        prisma.gateEntry.count({
          where: {
            createdAt: { gte: today, lt: tomorrow },
          },
        }),

        // Vehicles
        prisma.vehicle.count(),

        // Maintenance Bills
        prisma.maintenanceBill.count(),
        prisma.maintenanceBill.count({ where: { status: "PENDING" } }),
        prisma.maintenanceBill.count({ where: { status: "PAID" } }),
        prisma.maintenanceBill.count({
          where: { status: "PENDING", dueDate: { lt: new Date() } },
        }),

        // Service Bookings
        prisma.serviceBooking.count({
          where: {
            createdAt: { gte: today, lt: tomorrow },
          },
        }),
        prisma.serviceBooking.count({ where: { status: "PENDING" } }),
        prisma.serviceBooking.count({ where: { status: "COMPLETED" } }),
      ]);

      // Recent activities
      const recentComplaints = await prisma.complaint.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          resident: { select: { name: true, apartment: true } },
        },
      });

      const recentGateEntries = await prisma.gateEntry.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          resident: { select: { name: true, apartment: true } },
        },
      });

      const recentBookings = await prisma.serviceBooking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          resident: { select: { name: true, apartment: true } },
          serviceProvider: { select: { name: true, serviceCategory: true } },
        },
      });

      res.json({
        statistics: {
          residents: {
            total: totalResidents,
            active: activeResidents,
            pendingApprovals,
          },
          serviceProviders: {
            total: totalServiceProviders,
            active: activeServiceProviders,
            pending: pendingProviders,
          },
          employees: {
            total: totalEmployees,
            active: activeEmployees,
          },
          complaints: {
            total: totalComplaints,
            open: openComplaints,
            inProgress: inProgressComplaints,
            resolved: resolvedComplaints,
          },
          gateEntries: {
            today: todayGateEntries,
          },
          vehicles: {
            total: totalVehicles,
          },
          maintenanceBills: {
            total: totalMaintenanceBills,
            pending: pendingBills,
            paid: paidBills,
            overdue: overdueBills,
          },
          serviceBookings: {
            today: todayBookings,
            pending: pendingBookings,
            completed: completedBookings,
          },
        },
        recentActivities: {
          complaints: recentComplaints,
          gateEntries: recentGateEntries,
          bookings: recentBookings,
        },
      });
    } catch (error) {
      console.error("Get admin dashboard stats error:", error);
      res.status(500).json({
        error: "Failed to fetch dashboard statistics",
        message: "Internal server error",
      });
    }
  },
);

// Get resident dashboard statistics
router.get(
  "/resident/stats",
  authenticateAndVerify,
  async (req: AuthRequest, res) => {
    try {
      if (req.user!.type !== "resident") {
        return res.status(403).json({
          error: "Access denied",
          message: "This endpoint is for residents only",
        });
      }

      const residentId = req.user!.id;

      const [
        totalComplaints,
        openComplaints,
        totalBookings,
        pendingBookings,
        totalVehicles,
        totalBills,
        unpaidBills,
        overdueAmount,
      ] = await Promise.all([
        prisma.complaint.count({ where: { residentId } }),
        prisma.complaint.count({
          where: { residentId, status: "OPEN" },
        }),
        prisma.serviceBooking.count({ where: { residentId } }),
        prisma.serviceBooking.count({
          where: { residentId, status: "PENDING" },
        }),
        prisma.vehicle.count({ where: { residentId } }),
        prisma.maintenanceBill.count({ where: { residentId } }),
        prisma.maintenanceBill.count({
          where: { residentId, status: "PENDING" },
        }),
        prisma.maintenanceBill.aggregate({
          _sum: { amount: true },
          where: {
            residentId,
            status: "PENDING",
            dueDate: { lt: new Date() },
          },
        }),
      ]);

      // Recent activities
      const recentComplaints = await prisma.complaint.findMany({
        where: { residentId },
        take: 3,
        orderBy: { createdAt: "desc" },
      });

      const recentBookings = await prisma.serviceBooking.findMany({
        where: { residentId },
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
          serviceProvider: { select: { name: true, serviceCategory: true } },
        },
      });

      const upcomingBills = await prisma.maintenanceBill.findMany({
        where: {
          residentId,
          status: "PENDING",
          dueDate: { gte: new Date() },
        },
        take: 3,
        orderBy: { dueDate: "asc" },
        include: { items: true },
      });

      res.json({
        statistics: {
          complaints: {
            total: totalComplaints,
            open: openComplaints,
          },
          serviceBookings: {
            total: totalBookings,
            pending: pendingBookings,
          },
          vehicles: {
            total: totalVehicles,
          },
          bills: {
            total: totalBills,
            unpaid: unpaidBills,
            overdueAmount: overdueAmount._sum.amount || 0,
          },
        },
        recentActivities: {
          complaints: recentComplaints,
          bookings: recentBookings,
          upcomingBills,
        },
      });
    } catch (error) {
      console.error("Get resident dashboard stats error:", error);
      res.status(500).json({
        error: "Failed to fetch dashboard statistics",
        message: "Internal server error",
      });
    }
  },
);

// Get service provider dashboard statistics
router.get(
  "/service-provider/stats",
  authenticateAndVerify,
  async (req: AuthRequest, res) => {
    try {
      if (req.user!.type !== "serviceProvider") {
        return res.status(403).json({
          error: "Access denied",
          message: "This endpoint is for service providers only",
        });
      }

      const serviceProviderId = req.user!.id;

      const [
        totalBookings,
        pendingBookings,
        completedBookings,
        totalEarnings,
        totalReviews,
        averageRating,
        totalVehicles,
      ] = await Promise.all([
        prisma.serviceBooking.count({ where: { serviceProviderId } }),
        prisma.serviceBooking.count({
          where: { serviceProviderId, status: "PENDING" },
        }),
        prisma.serviceBooking.count({
          where: { serviceProviderId, status: "COMPLETED" },
        }),
        prisma.serviceBooking.aggregate({
          _sum: { actualCost: true },
          where: { serviceProviderId, status: "COMPLETED" },
        }),
        prisma.serviceReview.count({ where: { serviceProviderId } }),
        prisma.serviceReview.aggregate({
          _avg: { rating: true },
          where: { serviceProviderId },
        }),
        prisma.serviceProviderVehicle.count({ where: { serviceProviderId } }),
      ]);

      // Recent bookings
      const recentBookings = await prisma.serviceBooking.findMany({
        where: { serviceProviderId },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          resident: { select: { name: true, apartment: true } },
        },
      });

      // Recent reviews
      const recentReviews = await prisma.serviceReview.findMany({
        where: { serviceProviderId },
        take: 3,
        orderBy: { reviewDate: "desc" },
        include: {
          resident: { select: { name: true, apartment: true } },
        },
      });

      res.json({
        statistics: {
          bookings: {
            total: totalBookings,
            pending: pendingBookings,
            completed: completedBookings,
          },
          earnings: {
            total: totalEarnings._sum.actualCost || 0,
          },
          reviews: {
            total: totalReviews,
            averageRating: averageRating._avg.rating || 0,
          },
          vehicles: {
            total: totalVehicles,
          },
        },
        recentActivities: {
          bookings: recentBookings,
          reviews: recentReviews,
        },
      });
    } catch (error) {
      console.error("Get service provider dashboard stats error:", error);
      res.status(500).json({
        error: "Failed to fetch dashboard statistics",
        message: "Internal server error",
      });
    }
  },
);

export default router;
