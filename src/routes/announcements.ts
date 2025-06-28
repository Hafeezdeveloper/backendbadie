import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

const router = express.Router();

// Basic announcements routes - can be expanded later
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    res.json({ announcements });
  } catch (error) {
    console.error("Get announcements error:", error);
    res.status(500).json({
      error: "Failed to fetch announcements",
      message: "Internal server error",
    });
  }
});

export default router;
