import express from "express";
import { prisma } from "../server.js";
import {
  generateToken,
  hashPassword,
  comparePassword,
  AuthRequest,
} from "../lib/auth.js";
import {
  AdminLoginSchema,
  LoginSchema,
  ResidentRegistrationSchema,
  ServiceProviderRegistrationSchema,
} from "../lib/validations.js";
import { authenticateToken } from "@/lib/auth.middleware.js";

const router = express.Router();

// Admin login
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = AdminLoginSchema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || !(await comparePassword(password, admin.password))) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Username or password is incorrect",
      });
    }

    const token = generateToken({
      id: admin.id,
      type: "admin",
      email: admin.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        type: "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(400).json({
      error: "Login failed",
      message: error instanceof Error ? error.message : "Invalid input",
    });
  }
});

// Resident login
router.post("/resident/login", async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const resident = await prisma.resident.findUnique({
      where: { email },
    });

    if (
      !resident ||
      !resident.password ||
      !(await comparePassword(password, resident.password))
    ) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
    }

    if (resident.status !== "Active") {
      return res.status(403).json({
        error: "Account inactive",
        message: "Your account is not active",
      });
    }

    if (resident.approvalStatus !== "APPROVED") {
      return res.status(403).json({
        error: "Account not approved",
        message: "Your account is pending approval",
      });
    }

    const token = generateToken({
      id: resident.id,
      type: "resident",
      email: resident.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: resident.id,
        name: resident.name,
        email: resident.email,
        apartment: resident.apartment,
        type: "resident",
        status: resident.status,
        approvalStatus: resident.approvalStatus,
      },
    });
  } catch (error) {
    console.error("Resident login error:", error);
    res.status(400).json({
      error: "Login failed",
      message: error instanceof Error ? error.message : "Invalid input",
    });
  }
});

// Resident registration
router.post("/resident/register", async (req, res) => {
  try {
    const validatedData = ResidentRegistrationSchema.parse(req.body);

    // Check if email or apartment already exists
    const existingResident = await prisma.resident.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { apartment: validatedData.apartment },
        ],
      },
    });

    if (existingResident) {
      return res.status(400).json({
        error: "Resident already exists",
        message:
          existingResident.email === validatedData.email
            ? "Email is already registered"
            : "Apartment is already registered",
      });
    }

    // Hash password if provided
    let hashedPassword = null;
    if (validatedData.password) {
      hashedPassword = await hashPassword(validatedData.password);
    }

    // Create resident
    const resident = await prisma.resident.create({
      data: {
        ...validatedData,
        password: hashedPassword,
        approvalStatus: "PENDING",
        status: "Pending",
      },
    });

    res.status(201).json({
      message: "Registration successful",
      resident: {
        id: resident.id,
        name: resident.name,
        email: resident.email,
        apartment: resident.apartment,
        status: resident.status,
        approvalStatus: resident.approvalStatus,
      },
    });
  } catch (error) {
    console.error("Resident registration error:", error);
    res.status(400).json({
      error: "Registration failed",
      message: error instanceof Error ? error.message : "Invalid input",
    });
  }
});

// Service Provider login
router.post("/service-provider/login", async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    const serviceProvider = await prisma.serviceProvider.findUnique({
      where: { email },
    });

    if (
      !serviceProvider ||
      !(await comparePassword(password, serviceProvider.password))
    ) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
    }

    if (serviceProvider.status !== "ACTIVE") {
      return res.status(403).json({
        error: "Account not active",
        message: "Your account is not active or pending approval",
      });
    }

    const token = generateToken({
      id: serviceProvider.id,
      type: "serviceProvider",
      email: serviceProvider.email,
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: serviceProvider.id,
        name: serviceProvider.name,
        email: serviceProvider.email,
        username: serviceProvider.username,
        type: "serviceProvider",
        status: serviceProvider.status,
        serviceCategory: serviceProvider.serviceCategory,
      },
    });
  } catch (error) {
    console.error("Service provider login error:", error);
    res.status(400).json({
      error: "Login failed",
      message: error instanceof Error ? error.message : "Invalid input",
    });
  }
});

// Service Provider registration
router.post("/service-provider/register", async (req, res) => {
  try {
    const validatedData = ServiceProviderRegistrationSchema.parse(req.body);

    // Check if email or username already exists
    const existingProvider = await prisma.serviceProvider.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { username: validatedData.username },
        ],
      },
    });

    if (existingProvider) {
      return res.status(400).json({
        error: "Service provider already exists",
        message:
          existingProvider.email === validatedData.email
            ? "Email is already registered"
            : "Username is already taken",
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create service provider
    const serviceProvider = await prisma.serviceProvider.create({
      data: {
        ...validatedData,
        password: hashedPassword,
        status: "PENDING",
      },
    });

    res.status(201).json({
      message: "Registration successful",
      serviceProvider: {
        id: serviceProvider.id,
        name: serviceProvider.name,
        email: serviceProvider.email,
        username: serviceProvider.username,
        status: serviceProvider.status,
        serviceCategory: serviceProvider.serviceCategory,
      },
    });
  } catch (error) {
    console.error("Service provider registration error:", error);
    res.status(400).json({
      error: "Registration failed",
      message: error instanceof Error ? error.message : "Invalid input",
    });
  }
});

// Get current user
router.get("/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id, type } = req.user!;

    let user = null;
    switch (type) {
      case "admin":
        user = await prisma.admin.findUnique({
          where: { id },
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
          },
        });
        break;
      case "resident":
        user = await prisma.resident.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            apartment: true,
            status: true,
            approvalStatus: true,
            familyMembers: true,
            phone: true,
          },
        });
        break;
      case "serviceProvider":
        user = await prisma.serviceProvider.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            status: true,
            serviceCategory: true,
            rating: true,
            completedJobs: true,
          },
        });
        break;
      case "employee":
        user = await prisma.employee.findUnique({
          where: { id },
          select: {
            id: true,
            employeeId: true,
            name: true,
            email: true,
            designation: true,
            department: true,
            status: true,
          },
        });
        break;
    }

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User account does not exist",
      });
    }

    res.json({
      user: {
        ...user,
        type,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      error: "Failed to get user",
      message: "Internal server error",
    });
  }
});

// Refresh token
router.post("/refresh", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id, type, email } = req.user!;

    const newToken = generateToken({
      id,
      type,
      email,
    });

    res.json({
      message: "Token refreshed successfully",
      token: newToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      error: "Failed to refresh token",
      message: "Internal server error",
    });
  }
});

// Logout (client-side token removal, server doesn't store tokens)
router.post("/logout", authenticateToken, (req, res) => {
  res.json({
    message: "Logout successful",
  });
});

export default router;
