import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";


const router = express.Router();

// Basic vehicle routes - can be expanded later
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.user!.type === "resident") {
      where.residentId = req.user!.id;
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      include: {
        resident: {
          select: { name: true, apartment: true },
        },
      },
    });

    res.json({ vehicles });
  } catch (error) {
    console.error("Get vehicles error:", error);
    res.status(500).json({
      error: "Failed to fetch vehicles",
      message: "Internal server error",
    });
  }
});

export default router;
