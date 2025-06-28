import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

const router = express.Router();

// Basic complaints routes - can be expanded later
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.user!.type === "resident") {
      where.residentId = req.user!.id;
    }

    const complaints = await prisma.complaint.findMany({
      where,
      include: {
        resident: {
          select: { name: true, apartment: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ complaints });
  } catch (error) {
    console.error("Get complaints error:", error);
    res.status(500).json({
      error: "Failed to fetch complaints",
      message: "Internal server error",
    });
  }
});

export default router;
