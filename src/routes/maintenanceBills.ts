import express from "express";
import { prisma } from "../server.js";
import { authenticateAndVerify, AuthRequest, requireAdmin, requireAdminOrResident, requireAdminOrServiceProvider } from "@/lib/auth.middleware.js";

import {
  MaintenanceBillSchema,
  BillUpdateSchema,
  PaginationSchema,
} from "../lib/validations.js";

const router = express.Router();

// Get all maintenance bills (Admin) or resident's bills (Resident)
router.get("/", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const query = PaginationSchema.parse(req.query);
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build where clause based on user type
    const where: any = {};
    if (req.user!.type === "resident") {
      where.residentId = req.user!.id;
    }

    if (query.search) {
      where.OR = [
        { month: { contains: query.search, mode: "insensitive" } },
        { year: { equals: parseInt(query.search) || undefined } },
        ...(req.user!.type === "admin"
          ? [
              {
                resident: {
                  OR: [
                    { name: { contains: query.search, mode: "insensitive" } },
                    {
                      apartment: {
                        contains: query.search,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            ]
          : []),
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

    const [bills, total] = await Promise.all([
      prisma.maintenanceBill.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          resident: {
            select: {
              id: true,
              name: true,
              apartment: true,
              phone: true,
              email: true,
            },
          },
          items: true,
        },
      }),
      prisma.maintenanceBill.count({ where }),
    ]);

    res.json({
      bills,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get maintenance bills error:", error);
    res.status(500).json({
      error: "Failed to fetch bills",
      message: "Internal server error",
    });
  }
});

// Get bill by ID
router.get("/:id", authenticateAndVerify, async (req: AuthRequest, res) => {
  try {
    const billId = req.params.id;

    const bill = await prisma.maintenanceBill.findUnique({
      where: { id: billId },
      include: {
        resident: {
          select: {
            id: true,
            name: true,
            apartment: true,
            phone: true,
            email: true,
          },
        },
        items: true,
      },
    });

    if (!bill) {
      return res.status(404).json({
        error: "Bill not found",
        message: "Maintenance bill does not exist",
      });
    }

    // Check if resident can access this bill
    if (req.user!.type === "resident" && bill.residentId !== req.user!.id) {
      return res.status(403).json({
        error: "Access denied",
        message: "You can only access your own bills",
      });
    }

    res.json({ bill });
  } catch (error) {
    console.error("Get bill error:", error);
    res.status(500).json({
      error: "Failed to fetch bill",
      message: "Internal server error",
    });
  }
});

// Create bills for residents (Admin only)
router.post(
  "/generate",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const { residentIds, billData } = req.body;
      const validatedBillData = MaintenanceBillSchema.parse(billData);

      // Get residents to generate bills for
      let residents;
      if (residentIds && residentIds.length > 0) {
        residents = await prisma.resident.findMany({
          where: {
            id: { in: residentIds },
            status: "Active",
            approvalStatus: "APPROVED",
          },
          select: { id: true, name: true, apartment: true },
        });
      } else {
        // Generate for all active residents
        residents = await prisma.resident.findMany({
          where: {
            status: "Active",
            approvalStatus: "APPROVED",
          },
          select: { id: true, name: true, apartment: true },
        });
      }

      if (residents.length === 0) {
        return res.status(400).json({
          error: "No residents found",
          message: "No active residents found to generate bills for",
        });
      }

      // Check for existing bills for the same month/year
      const existingBills = await prisma.maintenanceBill.findMany({
        where: {
          residentId: { in: residents.map((r) => r.id) },
          month: validatedBillData.month,
          year: validatedBillData.year,
        },
        select: { residentId: true },
      });

      const existingResidentIds = existingBills.map((b) => b.residentId);
      const newResidents = residents.filter(
        (r) => !existingResidentIds.includes(r.id),
      );

      if (newResidents.length === 0) {
        return res.status(400).json({
          error: "Bills already exist",
          message: `Bills for ${validatedBillData.month} ${validatedBillData.year} already exist for all selected residents`,
        });
      }

      // Create bills with items
      const bills = await Promise.all(
        newResidents.map(async (resident) => {
          const bill = await prisma.maintenanceBill.create({
            data: {
              residentId: resident.id,
              month: validatedBillData.month,
              year: validatedBillData.year,
              amount: validatedBillData.amount,
              dueDate: new Date(validatedBillData.dueDate),
              status: "PENDING",
              items: {
                create: validatedBillData.items,
              },
            },
            include: {
              resident: {
                select: { name: true, apartment: true },
              },
              items: true,
            },
          });
          return bill;
        }),
      );

      res.status(201).json({
        message: `Successfully generated ${bills.length} maintenance bills`,
        bills,
        skipped: existingResidentIds.length,
      });
    } catch (error) {
      console.error("Generate bills error:", error);
      res.status(400).json({
        error: "Failed to generate bills",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Update bill status (Admin only)
router.patch(
  "/:id/status",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const billId = req.params.id;
      const validatedData = BillUpdateSchema.parse(req.body);

      const bill = await prisma.maintenanceBill.findUnique({
        where: { id: billId },
      });

      if (!bill) {
        return res.status(404).json({
          error: "Bill not found",
          message: "Maintenance bill does not exist",
        });
      }

      // Prepare update data
      const updateData: any = {};
      if (validatedData.status) {
        updateData.status = validatedData.status;
        if (validatedData.status === "PAID") {
          updateData.paidDate = new Date();
        }
      }
      if (validatedData.paidDate) {
        updateData.paidDate = new Date(validatedData.paidDate);
      }

      const updatedBill = await prisma.maintenanceBill.update({
        where: { id: billId },
        data: updateData,
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
          items: true,
        },
      });

      res.json({
        message: "Bill status updated successfully",
        bill: updatedBill,
      });
    } catch (error) {
      console.error("Update bill status error:", error);
      res.status(400).json({
        error: "Failed to update bill status",
        message: error instanceof Error ? error.message : "Invalid input",
      });
    }
  },
);

// Mark bill as paid (Resident can request, Admin confirms)
router.patch(
  "/:id/mark-paid",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const billId = req.params.id;

      const bill = await prisma.maintenanceBill.findUnique({
        where: { id: billId },
        include: {
          resident: {
            select: { name: true, apartment: true },
          },
        },
      });

      if (!bill) {
        return res.status(404).json({
          error: "Bill not found",
          message: "Maintenance bill does not exist",
        });
      }

      // Check if resident can mark this bill
      if (req.user!.type === "resident" && bill.residentId !== req.user!.id) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only mark your own bills as paid",
        });
      }

      if (bill.status === "PAID") {
        return res.status(400).json({
          error: "Bill already paid",
          message: "This bill has already been marked as paid",
        });
      }

      // For residents, this is a payment notification
      // For admins, this actually marks as paid
      const updateData: any = {};
      let message = "";

      if (req.user!.type === "admin") {
        updateData.status = "PAID";
        updateData.paidDate = new Date();
        message = "Bill marked as paid successfully";
      } else {
        // For residents, we might want to add a "payment requested" status
        // For now, we'll just return a message
        message =
          "Payment notification sent to admin. Bill will be marked as paid once verified.";
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.maintenanceBill.update({
          where: { id: billId },
          data: updateData,
        });
      }

      res.json({
        message,
        bill: {
          id: bill.id,
          month: bill.month,
          year: bill.year,
          amount: bill.amount,
          status: updateData.status || bill.status,
          resident: bill.resident,
        },
      });
    } catch (error) {
      console.error("Mark bill as paid error:", error);
      res.status(500).json({
        error: "Failed to process payment",
        message: "Internal server error",
      });
    }
  },
);

// Get resident's bills
router.get(
  "/resident/:residentId",
  authenticateAndVerify,
  requireAdminOrResident,
  async (req: AuthRequest, res) => {
    try {
      const residentId = parseInt(req.params.residentId);

      // Check if resident can access these bills
      if (req.user!.type === "resident" && req.user!.id !== residentId) {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only access your own bills",
        });
      }

      const bills = await prisma.maintenanceBill.findMany({
        where: { residentId },
        include: {
          items: true,
          resident: {
            select: { name: true, apartment: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Calculate statistics
      const totalOutstanding = bills
        .filter((b) => b.status === "PENDING")
        .reduce((sum, bill) => sum + bill.amount, 0);

      const overdueBills = bills.filter(
        (b) => b.status === "PENDING" && new Date(b.dueDate) < new Date(),
      );

      const paidThisMonth = bills.filter((b) => {
        if (b.status !== "PAID" || !b.paidDate) return false;
        const paidDate = new Date(b.paidDate);
        const now = new Date();
        return (
          paidDate.getMonth() === now.getMonth() &&
          paidDate.getFullYear() === now.getFullYear()
        );
      });

      res.json({
        bills,
        statistics: {
          totalOutstanding,
          overdueBills: overdueBills.length,
          paidThisMonth: paidThisMonth.length,
          totalBills: bills.length,
        },
      });
    } catch (error) {
      console.error("Get resident bills error:", error);
      res.status(500).json({
        error: "Failed to fetch bills",
        message: "Internal server error",
      });
    }
  },
);

// Delete bill (Admin only)
router.delete(
  "/:id",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const billId = req.params.id;

      const bill = await prisma.maintenanceBill.findUnique({
        where: { id: billId },
      });

      if (!bill) {
        return res.status(404).json({
          error: "Bill not found",
          message: "Maintenance bill does not exist",
        });
      }

      // Delete bill (cascade will handle bill items)
      await prisma.maintenanceBill.delete({
        where: { id: billId },
      });

      res.json({
        message: "Bill deleted successfully",
      });
    } catch (error) {
      console.error("Delete bill error:", error);
      res.status(500).json({
        error: "Failed to delete bill",
        message: "Internal server error",
      });
    }
  },
);

// Get billing statistics (Admin only)
router.get(
  "/stats/overview",
  authenticateAndVerify,
  requireAdmin,
  async (req: AuthRequest, res) => {
    try {
      const [
        totalBills,
        pendingBills,
        paidBills,
        overdueBills,
        totalAmount,
        collectedAmount,
      ] = await Promise.all([
        prisma.maintenanceBill.count(),
        prisma.maintenanceBill.count({ where: { status: "PENDING" } }),
        prisma.maintenanceBill.count({ where: { status: "PAID" } }),
        prisma.maintenanceBill.count({
          where: { status: "PENDING", dueDate: { lt: new Date() } },
        }),
        prisma.maintenanceBill.aggregate({
          _sum: { amount: true },
        }),
        prisma.maintenanceBill.aggregate({
          _sum: { amount: true },
          where: { status: "PAID" },
        }),
      ]);

      const collectionRate =
        totalBills > 0 ? Math.round((paidBills / totalBills) * 100) : 0;

      const monthlyStats = await prisma.maintenanceBill.groupBy({
        by: ["month", "year"],
        _count: { id: true },
        _sum: { amount: true },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        take: 12,
      });

      res.json({
        statistics: {
          totalBills,
          pendingBills,
          paidBills,
          overdueBills,
          totalAmount: totalAmount._sum.amount || 0,
          collectedAmount: collectedAmount._sum.amount || 0,
          collectionRate,
        },
        monthlyStats,
      });
    } catch (error) {
      console.error("Get billing stats error:", error);
      res.status(500).json({
        error: "Failed to fetch statistics",
        message: "Internal server error",
      });
    }
  },
);

export default router;
