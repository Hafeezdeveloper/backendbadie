import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Import routes
import authRoutes from "./routes/auth.js";
import residentsRoutes from "./routes/residents.js";
import serviceProvidersRoutes from "./routes/serviceProviders.js";
import employeesRoutes from "./routes/employees.js";
import vehiclesRoutes from "./routes/vehicles.js";
import complaintsRoutes from "./routes/complaints.js";
import serviceBookingsRoutes from "./routes/serviceBookings.js";
import maintenanceBillsRoutes from "./routes/maintenanceBills.js";
import gateEntriesRoutes from "./routes/gateEntries.js";
import guestsRoutes from "./routes/guests.js";
import deliveriesRoutes from "./routes/deliveries.js";
import announcementsRoutes from "./routes/announcements.js";
import dashboardRoutes from "./routes/dashboard.js";

// Load environment variables
dotenv.config();

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

const corsOptions = {
  origin: "*", // Allows ALL origins (least secure)
  credentials: false, // Disable credentials when allowing all origins
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept"],
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" })); // Increased limit for base64 images
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Residential Management API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/residents", residentsRoutes);
app.use("/api/service-providers", serviceProvidersRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/vehicles", vehiclesRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/service-bookings", serviceBookingsRoutes);
app.use("/api/maintenance-bills", maintenanceBillsRoutes);
app.use("/api/gate-entries", gateEntriesRoutes);
app.use("/api/guests", guestsRoutes);
app.use("/api/deliveries", deliveriesRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/dashboard", dashboardRoutes);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Global error handler:", err);

    // Prisma errors
    if (err.code === "P2002") {
      return res.status(400).json({
        error: "Duplicate entry",
        message: "A record with this data already exists.",
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        error: "Record not found",
        message: "The requested record does not exist.",
      });
    }

    // Validation errors
    if (err.name === "ZodError") {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid input data",
        details: err.errors,
      });
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
        message: "Authentication token is invalid.",
      });
    }

    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Token expired",
        message: "Authentication token has expired.",
      });
    }

    // Default error
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || "Internal server error";

    res.status(statusCode).json({
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.name || "Error",
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong"
          : message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  },
);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  // Test database connection
  prisma
    .$connect()
    .then(() => console.log("✅ Database connected successfully"))
    .catch((error) => console.error("❌ Database connection failed:", error));
});

export default app;
