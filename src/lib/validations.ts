import { z } from "zod";

// Common schemas
export const IdDocumentSchema = z.enum(["CNIC", "PASSPORT", "DRIVER_LICENSE"]);
export const OwnershipTypeSchema = z.enum(["OWNER", "TENANT"]);
export const VehicleTypeSchema = z.enum([
  "CAR",
  "BIKE",
  "SCOOTER",
  "TRUCK",
  "MOTORCYCLE",
]);
export const PrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const AdminLoginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Resident schemas
export const ResidentRegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  apartment: z.string().min(1, "Apartment is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Invalid email address"),
  familyMembers: z.number().min(1, "Family members must be at least 1"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .optional(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .optional(),

  // KYC fields
  idDocumentType: IdDocumentSchema,
  cnicNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  driverLicenseNumber: z.string().optional(),
  ownershipType: OwnershipTypeSchema,
  emergencyContact: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  occupation: z.string().optional(),
  workAddress: z.string().optional(),
  monthlyIncome: z.number().optional(),
  previousAddress: z.string().optional(),
  reference1Name: z.string().optional(),
  reference1Phone: z.string().optional(),
  reference2Name: z.string().optional(),
  reference2Phone: z.string().optional(),
  additionalNotes: z.string().optional(),
  profilePhoto: z.string().optional(),
});

export const ResidentUpdateSchema = ResidentRegistrationSchema.partial();

// Service Provider schemas
export const ServiceProviderRegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),

  // KYC fields
  idDocumentType: IdDocumentSchema,
  cnicNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  driverLicenseNumber: z.string().optional(),

  // Service fields
  serviceCategory: z.string(),
  keywords: z.string(),
  shortIntro: z.string(),
  experience: z.string(),
  previousWork: z.string().optional(),
  certifications: z.string().optional(),
  availability: z.string(),
  serviceArea: z.string(),
  profilePhoto: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export const ServiceProviderUpdateSchema =
  ServiceProviderRegistrationSchema.partial();

// Employee schemas
export const EmployeeRegistrationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  designation: z.string().min(1, "Designation is required"),
  department: z.string().min(1, "Department is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().min(5, "Address must be at least 5 characters"),

  // KYC fields
  idDocumentType: IdDocumentSchema,
  cnicNumber: z.string().optional(),
  passportNumber: z.string().optional(),
  driverLicenseNumber: z.string().optional(),

  emergencyContact: z.string().min(2, "Emergency contact name is required"),
  emergencyContactPhone: z
    .string()
    .min(10, "Emergency contact phone is required"),
  joiningDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Invalid date"),
});

export const EmployeeUpdateSchema = EmployeeRegistrationSchema.partial();

// Vehicle schemas
export const VehicleRegistrationSchema = z.object({
  vehicleType: VehicleTypeSchema,
  make: z.string().min(1, "Vehicle make is required"),
  model: z.string().min(1, "Vehicle model is required"),
  year: z
    .number()
    .min(1990, "Year must be 1990 or later")
    .max(new Date().getFullYear() + 1),
  color: z.string().min(1, "Vehicle color is required"),
  licensePlate: z.string().min(1, "License plate is required"),
});

export const VehicleUpdateSchema = VehicleRegistrationSchema.partial();

// Complaint schemas
export const ComplaintSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  category: z.string().min(1, "Category is required"),
  priority: PrioritySchema,
  description: z.string().min(10, "Description must be at least 10 characters"),
  images: z.array(z.string()).optional(),
});

export const ComplaintUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  adminResponse: z.string().optional(),
});

// Service Booking schemas
export const ServiceBookingSchema = z.object({
  serviceProviderId: z.number().min(1, "Service provider is required"),
  serviceCategory: z.string().min(1, "Service category is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  scheduledDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Invalid date"),
  scheduledTime: z.string().min(1, "Scheduled time is required"),
  priority: PrioritySchema.optional(),
  estimatedCost: z.number().optional(),
  notes: z.string().optional(),
});

export const BookingUpdateSchema = z.object({
  status: z
    .enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
  actualCost: z.number().optional(),
  notes: z.string().optional(),
  completionDate: z.string().optional(),
});

// Maintenance Bill schemas
export const MaintenanceBillSchema = z.object({
  month: z.string().min(1, "Month is required"),
  year: z.number().min(2020, "Year must be 2020 or later"),
  amount: z.number().min(0, "Amount must be positive"),
  dueDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Invalid due date"),
  items: z.array(
    z.object({
      description: z.string().min(1, "Item description is required"),
      amount: z.number().min(0, "Item amount must be positive"),
      type: z.enum(["FIXED", "VARIABLE", "ONE_TIME"]),
    }),
  ),
});

export const BillUpdateSchema = z.object({
  status: z.enum(["PENDING", "PAID", "OVERDUE"]).optional(),
  paidDate: z.string().optional(),
});

// Guest schemas
export const GuestRegistrationSchema = z.object({
  guestName: z.string().min(2, "Guest name must be at least 2 characters"),
  purpose: z.string().min(1, "Purpose is required"),
  visitDate: z
    .string()
    .refine((date) => !isNaN(Date.parse(date)), "Invalid visit date"),
  timeFrom: z.string().min(1, "Start time is required"),
  timeTo: z.string().min(1, "End time is required"),
  vehicleType: z.string().optional(),
  licensePlate: z.string().optional(),
  idNumber: z.string().min(1, "ID number is required"),
  idType: IdDocumentSchema,
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
});

// Delivery schemas
export const DeliveryRegistrationSchema = z.object({
  riderName: z.string().min(2, "Rider name must be at least 2 characters"),
  idNumber: z.string().min(1, "ID number is required"),
  idType: IdDocumentSchema,
  companyName: z.string().min(1, "Company name is required"),
  description: z.string().min(1, "Description is required"),
});

// Gate Entry schemas
export const GateEntrySchema = z.object({
  type: z.enum(["ENTRY", "EXIT"]),
  person: z.string().min(1, "Person name is required"),
  apartment: z.string().min(1, "Apartment is required"),
  entryType: z.string().min(1, "Entry type is required"),
  vehicle: z.string().optional(),
  gate: z.string().optional(),
  method: z.string().optional(),
  residentId: z.number().optional(),
});

// Announcement schemas
export const AnnouncementSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  type: z.string().min(1, "Type is required"),
  priority: PrioritySchema,
  description: z.string().min(10, "Description must be at least 10 characters"),
});

// Service Review schemas
export const ServiceReviewSchema = z.object({
  bookingId: z.number().min(1, "Booking ID is required"),
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  review: z.string().min(10, "Review must be at least 10 characters"),
  serviceCategory: z.string().min(1, "Service category is required"),
});

// Query parameter schemas
export const PaginationSchema = z.object({
  page: z
    .string()
    .transform(Number)
    .refine((n) => n > 0, "Page must be positive")
    .optional(),
  limit: z
    .string()
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, "Limit must be between 1 and 100")
    .optional(),
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});
