import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

import {
  EmployeeRegistrationSchema,
  EmployeeUpdateSchema,
  PaginationSchema,
} from "../lib/validations.js";

const router = express.Router();

// Get all employees (Admin only)
router.get(
  "/",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
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
          { employeeId: { contains: query.search, mode: "insensitive" } },
          { designation: { contains: query.search, mode: "insensitive" } },
          { department: { contains: query.search, mode: "insensitive" } },
        ];
      }
      if (query.status) {
        where.status = query.status;
      }

      // Build order clause
      const orderBy: any = {};
      if (query.sort) {
        orderBy[query.sort] = query.order || "asc";
      } else {
        orderBy.createdAt = "desc";
      }

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            employeeId: true,
            name: true,
            designation: true,
            department: true,
            email: true,
            phone: true,
            address: true,
            status: true,
            joiningDate: true,
            emergencyContact: true,
            emergencyContactPhone: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.employee.count({ where }),
      ]);

      res.json({
        employees,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get employees error:", error);
      res.status(500).json({
        error: "Failed to fetch employees",
        message: "Internal server error",
      });
    }
  },
);

// Get employee by ID (Admin only)
router.get(
  "/:id",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const employeeId = req.params.id;

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return res.status(404).json({
          error: "Employee not found",
          message: "Employee does not exist",
        });
      }

      res.json({ employee });
    } catch (error) {
      console.error("Get employee error:", error);
      res.status(500).json({
        error: "Failed to fetch employee",
        message: "Internal server error",
      });
    }
  },
);

// Create new employee (Admin only)
router.post(
  "/",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const validatedData = EmployeeRegistrationSchema.parse(req.body);

      // Check if email already exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { email: validatedData.email },
      });

      if (existingEmployee) {
        return res.status(400).json({
          error: "Employee already exists",
          message: "Email is already registered",
        });
      }

      // Generate unique employee ID
      const lastEmployee = await prisma.employee.findFirst({
        orderBy: { employeeId: "desc" },
      });

      let employeeIdNumber = 1;
      if (lastEmployee && lastEmployee.employeeId) {
        const lastNumber = parseInt(lastEmployee.employeeId.replace("EMP", ""));
        employeeIdNumber = lastNumber + 1;
      }

      const employeeId = `EMP${employeeIdNumber.toString().padStart(3, "0")}`;

      // Create employee
      const employee = await prisma.employee.create({
        data: {
          ...validatedData,
          employeeId,
          joiningDate: new Date(validatedData.joiningDate),
        },
        select: {
          id: true,
          employeeId: true,
          name: true,
          designation: true,
          department: true,
          email: true,
          phone: true,
          status: true,
          joiningDate: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        message: "Employee registered successfully",
        employee,
      });
    } catch (error) {
      console.error("Create employee error:", error);
      res.status(400).json({
        error: "Failed to register employee",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Update employee (Admin only)
router.patch(
  "/:id",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const employeeId = req.params.id;
      const validatedData = EmployeeUpdateSchema.parse(req.body);

      // Check if employee exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!existingEmployee) {
        return res.status(404).json({
          error: "Employee not found",
          message: "Employee does not exist",
        });
      }

      // Check for duplicate email (if updating)
      if (validatedData.email) {
        const duplicate = await prisma.employee.findFirst({
          where: {
            AND: [{ id: { not: employeeId } }, { email: validatedData.email }],
          },
        });

        if (duplicate) {
          return res.status(400).json({
            error: "Duplicate email",
            message: "Email is already in use",
          });
        }
      }

      // Prepare update data
      const updateData: any = { ...validatedData };
      if (validatedData.joiningDate) {
        updateData.joiningDate = new Date(validatedData.joiningDate);
      }

      // Update employee
      const updatedEmployee = await prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
        select: {
          id: true,
          employeeId: true,
          name: true,
          designation: true,
          department: true,
          email: true,
          phone: true,
          address: true,
          status: true,
          joiningDate: true,
          emergencyContact: true,
          emergencyContactPhone: true,
          updatedAt: true,
        },
      });

      res.json({
        message: "Employee updated successfully",
        employee: updatedEmployee,
      });
    } catch (error) {
      console.error("Update employee error:", error);
      res.status(400).json({
        error: "Failed to update employee",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Update employee status (Admin only)
router.patch(
  "/:id/status",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const employeeId = req.params.id;
      const { status } = req.body;

      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          error: "Invalid status",
          message: "Status must be ACTIVE or INACTIVE",
        });
      }

      const updatedEmployee = await prisma.employee.update({
        where: { id: employeeId },
        data: { status },
        select: {
          id: true,
          employeeId: true,
          name: true,
          designation: true,
          status: true,
        },
      });

      res.json({
        message: `Employee status updated to ${status.toLowerCase()}`,
        employee: updatedEmployee,
      });
    } catch (error) {
      console.error("Update employee status error:", error);
      res.status(500).json({
        error: "Failed to update status",
        message: "Internal server error",
      });
    }
  },
);

// Generate QR code for employee (Admin only)
router.get(
  "/:id/qr-code",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const employeeId = req.params.id;

      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          employeeId: true,
          name: true,
          designation: true,
          department: true,
          status: true,
          createdAt: true,
        },
      });

      if (!employee) {
        return res.status(404).json({
          error: "Employee not found",
          message: "Employee does not exist",
        });
      }

      const qrData = {
        type: "employee_entry",
        employeeId: employee.employeeId,
        employeeName: employee.name,
        designation: employee.designation,
        department: employee.department,
        status: employee.status,
        registrationDate: employee.createdAt.toISOString().split("T")[0],
      };

      res.json({
        qrCode: JSON.stringify(qrData),
        employee: {
          id: employee.id,
          employeeId: employee.employeeId,
          name: employee.name,
          designation: employee.designation,
          department: employee.department,
        },
      });
    } catch (error) {
      console.error("Generate employee QR code error:", error);
      res.status(500).json({
        error: "Failed to generate QR code",
        message: "Internal server error",
      });
    }
  },
);

// Get departments list (Admin only)
router.get(
  "/departments/list",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const departments = await prisma.employee.findMany({
        select: { department: true },
        distinct: ["department"],
      });

      const departmentList = departments.map((dept) => dept.department);

      res.json({ departments: departmentList });
    } catch (error) {
      console.error("Get departments error:", error);
      res.status(500).json({
        error: "Failed to fetch departments",
        message: "Internal server error",
      });
    }
  },
);

// Get designations list (Admin only)
router.get(
  "/designations/list",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const designations = await prisma.employee.findMany({
        select: { designation: true },
        distinct: ["designation"],
      });

      const designationList = designations.map((des) => des.designation);

      res.json({ designations: designationList });
    } catch (error) {
      console.error("Get designations error:", error);
      res.status(500).json({
        error: "Failed to fetch designations",
        message: "Internal server error",
      });
    }
  },
);

// Delete employee (Admin only)
router.delete(
  "/:id",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const employeeId = req.params.id;

      // Check if employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return res.status(404).json({
          error: "Employee not found",
          message: "Employee does not exist",
        });
      }

      // Delete employee
      await prisma.employee.delete({
        where: { id: employeeId },
      });

      res.json({
        message: "Employee deleted successfully",
      });
    } catch (error) {
      console.error("Delete employee error:", error);
      res.status(500).json({
        error: "Failed to delete employee",
        message: "Internal server error",
      });
    }
  },
);

// Get employee statistics (Admin only)
router.get(
  "/stats/overview",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [totalEmployees, activeEmployees, inactiveEmployees] =
        await Promise.all([
          prisma.employee.count(),
          prisma.employee.count({ where: { status: "ACTIVE" } }),
          prisma.employee.count({ where: { status: "INACTIVE" } }),
        ]);

      const departmentStats = await prisma.employee.groupBy({
        by: ["department"],
        _count: {
          department: true,
        },
        where: { status: "ACTIVE" },
      });

      const recentHires = await prisma.employee.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          employeeId: true,
          name: true,
          designation: true,
          department: true,
          joiningDate: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      res.json({
        statistics: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees,
        },
        departmentStats,
        recentHires,
      });
    } catch (error) {
      console.error("Get employee stats error:", error);
      res.status(500).json({
        error: "Failed to fetch statistics",
        message: "Internal server error",
      });
    }
  },
);

export default router;
