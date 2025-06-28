import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

const router = express.Router();

// Basic deliveries routes - can be expanded later
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.user!.type === "resident") {
      where.residentId = req.user!.id;
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        resident: {
          select: { name: true, apartment: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ deliveries });
  } catch (error) {
    console.error("Get deliveries error:", error);
    res.status(500).json({
      error: "Failed to fetch deliveries",
      message: "Internal server error",
    });
  }
});

export default router;
