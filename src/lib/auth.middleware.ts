import { Request, Response, NextFunction } from "express";
import { prisma } from "../server.js";
import { verifyToken } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    type: "admin" | "resident" | "serviceProvider" | "employee";
    email: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Access denied",
        message: "No token provided",
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      error: "Invalid token",
      message: "Token is not valid or has expired",
    });
  }
};

export const verifyUserExists = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    const { id, type } = req.user;
    let user = null;
    console.log(req.user)
    switch (type) {
      case "admin":
        user = await prisma.admin.findUnique({
          where: { id: new ObjectId(id) }, // ✅ correct ObjectId format
          select: {
            id: true,
            status: true, // ✅ Only works if schema includes this
          }
        });
        break;

      case "resident":
        user = await prisma.resident.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            approvalStatus: true
          },
        });
        if (user && (user.status !== "Active" || user.approvalStatus !== "APPROVED")) {
          return res.status(403).json({
            error: "Account inactive",
            message: "Your resident account is not active or approved",
          });
        }
        break;

      case "serviceProvider":
        user = await prisma.serviceProvider.findUnique({
          where: { id },
          select: {
            id: true,
            status: true
          },
        });
        if (user && user.status !== "ACTIVE") {
          return res.status(403).json({
            error: "Account inactive",
            message: "Your service provider account is not active",
          });
        }
        break;

      case "employee":
        user = await prisma.employee.findUnique({
          where: { id },
          select: {
            id: true,
            status: true
          },
        });
        if (user && user.status !== "ACTIVE") {
          return res.status(403).json({
            error: "Account inactive",
            message: "Your employee account is not active",
          });
        }
        break;

      default:
        return res.status(403).json({
          error: "Invalid user type",
          message: "Unrecognized user type",
        });
    }

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User account does not exist",
      });
    }

    next();
  } catch (error) {
    console.error("Error verifying user:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to verify user account",
    });
  }
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "User not authenticated",
      });
    }

    if (!allowedRoles.includes(req.user.type)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You don't have permission to access this resource",
      });
    }

    next();
  };
};

// Pre-configured role middlewares
export const requireAdmin = authorizeRoles("admin");
export const requireResident = authorizeRoles("resident");
export const requireServiceProvider = authorizeRoles("serviceProvider");
export const requireEmployee = authorizeRoles("employee");
export const requireAdminOrResident = authorizeRoles("admin", "resident");
export const requireAdminOrServiceProvider = authorizeRoles("admin", "serviceProvider");
export const requireAdminOrEmployee = authorizeRoles("admin", "employee");

// Combined authentication and verification middleware
export const authenticateAndVerify = [authenticateToken, verifyUserExists];

// Combined middleware with role checking
export const authWithRole = (...roles: string[]) => [
  ...authenticateAndVerify,
  authorizeRoles(...roles),
];