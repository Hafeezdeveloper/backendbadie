import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

const router = express.Router();

// Basic service bookings routes - can be expanded later
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.user!.type === "resident") {
      where.residentId = req.user!.id;
    } else if (req.user!.type === "serviceProvider") {
      where.serviceProviderId = req.user!.id;
    }

    const bookings = await prisma.serviceBooking.findMany({
      where,
      include: {
        resident: {
          select: { name: true, apartment: true },
        },
        serviceProvider: {
          select: { name: true, serviceCategory: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ bookings });
  } catch (error) {
    console.error("Get service bookings error:", error);
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: "Internal server error",
    });
  }
});

export default router;
