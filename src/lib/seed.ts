import { PrismaClient } from "@prisma/client";
import { hashPassword } from "./auth.js";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  try {
    // Create admin user
    const adminPassword = await hashPassword("admin123");
    const admin = await prisma.admin.upsert({
      where: { username: "admin" },
      update: {},
      create: {
        username: "admin",
        password: adminPassword,
        email: "admin@residentialapp.com",
        name: "System Administrator",
        role: "SUPER_ADMIN",
      },
    });
    console.log("✅ Admin user created:", admin.username);

    // Create sample residents
    const residentPassword = await hashPassword("resident123");
    const residents = await prisma.$transaction([
      prisma.resident.upsert({
        where: { email: "john.smith@example.com" },
        update: {},
        create: {
          name: "John Smith",
          apartment: "A-101",
          phone: "+1-234-567-8901",
          email: "john.smith@example.com",
          password: residentPassword,
          status: "ACTIVE",
          approvalStatus: "APPROVED",
          familyMembers: 4,
          username: "johnsmith",
          idDocumentType: "CNIC",
          cnicNumber: "42101-1234567-8",
          ownershipType: "OWNER",
          occupation: "Software Engineer",
          emergencyContact: "Jane Smith",
          emergencyContactPhone: "+1-234-567-8902",
        },
      }),
      prisma.resident.upsert({
        where: { email: "sarah.johnson@example.com" },
        update: {},
        create: {
          name: "Sarah Johnson",
          apartment: "B-205",
          phone: "+1-987-654-3210",
          email: "sarah.johnson@example.com",
          password: residentPassword,
          status: "ACTIVE",
          approvalStatus: "APPROVED",
          familyMembers: 2,
          username: "sarahjohnson",
          idDocumentType: "PASSPORT",
          passportNumber: "AB1234567",
          ownershipType: "TENANT",
          occupation: "Doctor",
          emergencyContact: "Mike Johnson",
          emergencyContactPhone: "+1-987-654-3211",
        },
      }),
      prisma.resident.upsert({
        where: { email: "ahmed.khan@example.com" },
        update: {},
        create: {
          name: "Ahmed Khan",
          apartment: "C-301",
          phone: "+92-300-1234567",
          email: "ahmed.khan@example.com",
          password: residentPassword,
          status: "ACTIVE",
          approvalStatus: "APPROVED",
          familyMembers: 3,
          username: "ahmedkhan",
          idDocumentType: "CNIC",
          cnicNumber: "42101-7654321-9",
          ownershipType: "OWNER",
          occupation: "Business Owner",
          emergencyContact: "Fatima Khan",
          emergencyContactPhone: "+92-300-7654321",
        },
      }),
    ]);
    console.log("✅ Sample residents created:", residents.length);

    // Create sample service providers
    const serviceProviderPassword = await hashPassword("provider123");
    const serviceProviders = await prisma.$transaction([
      prisma.serviceProvider.upsert({
        where: { email: "ahmad.plumber@example.com" },
        update: {},
        create: {
          name: "Ahmad Ali",
          username: "ahmadplumber",
          email: "ahmad.plumber@example.com",
          phone: "+92-301-1111111",
          password: serviceProviderPassword,
          idDocumentType: "CNIC",
          cnicNumber: "42101-1111111-1",
          serviceCategory: "PLUMBING",
          keywords: "plumbing, pipes, water, leakage, bathroom, kitchen",
          shortIntro: "Professional plumber with 10+ years experience",
          experience: "10+ years",
          previousWork: "Worked with multiple residential complexes",
          certifications: "Certified Plumber License",
          availability: "Monday to Saturday, 8 AM to 6 PM",
          serviceArea: "Karachi",
          additionalNotes: "Specializes in bathroom and kitchen plumbing",
          status: "ACTIVE",
          rating: 4.5,
          totalReviews: 25,
          completedJobs: 150,
        },
      }),
      prisma.serviceProvider.upsert({
        where: { email: "maria.cleaner@example.com" },
        update: {},
        create: {
          name: "Maria Rodriguez",
          username: "mariacleaner",
          email: "maria.cleaner@example.com",
          phone: "+92-301-2222222",
          password: serviceProviderPassword,
          idDocumentType: "CNIC",
          cnicNumber: "42101-2222222-2",
          serviceCategory: "CLEANING",
          keywords: "cleaning, housekeeping, deep clean, maintenance",
          shortIntro: "Professional cleaning service for homes and offices",
          experience: "5+ years",
          previousWork: "Residential and commercial cleaning",
          certifications: "Professional Cleaning Certificate",
          availability: "7 days a week, flexible hours",
          serviceArea: "Karachi",
          additionalNotes: "Eco-friendly cleaning products available",
          status: "ACTIVE",
          rating: 4.8,
          totalReviews: 40,
          completedJobs: 200,
        },
      }),
      prisma.serviceProvider.upsert({
        where: { email: "hassan.electrician@example.com" },
        update: {},
        create: {
          name: "Hassan Ahmed",
          username: "hassanelectrician",
          email: "hassan.electrician@example.com",
          phone: "+92-301-3333333",
          password: serviceProviderPassword,
          idDocumentType: "CNIC",
          cnicNumber: "42101-3333333-3",
          serviceCategory: "ELECTRICAL",
          keywords: "electrical, wiring, repair, installation, lights",
          shortIntro: "Licensed electrician for all electrical needs",
          experience: "8+ years",
          previousWork: "Residential and commercial electrical work",
          certifications: "Licensed Electrician",
          availability: "Monday to Saturday, 9 AM to 8 PM",
          serviceArea: "Karachi",
          additionalNotes: "Emergency services available",
          status: "ACTIVE",
          rating: 4.3,
          totalReviews: 30,
          completedJobs: 120,
        },
      }),
    ]);
    console.log("✅ Sample service providers created:", serviceProviders.length);

    // Create sample employees
    const employees = await prisma.$transaction([
      prisma.employee.upsert({
        where: { email: "security1@residentialapp.com" },
        update: {},
        create: {
          employeeId: "EMP001",
          name: "Usman Ali",
          designation: "Security Guard",
          department: "SECURITY",
          email: "security1@residentialapp.com",
          phone: "+92-300-4444444",
          address: "123 Security Street, Karachi",
          idDocumentType: "CNIC",
          cnicNumber: "42101-4444444-4",
          emergencyContact: "Zainab Ali",
          emergencyContactPhone: "+92-300-5555555",
          joiningDate: new Date("2024-01-15"),
          status: "ACTIVE",
        },
      }),
      prisma.employee.upsert({
        where: { email: "maintenance1@residentialapp.com" },
        update: {},
        create: {
          employeeId: "EMP002",
          name: "Carlos Santos",
          designation: "Maintenance Supervisor",
          department: "MAINTENANCE",
          email: "maintenance1@residentialapp.com",
          phone: "+92-301-6666666",
          address: "456 Maintenance Ave, Karachi",
          idDocumentType: "PASSPORT",
          passportNumber: "CD7890123",
          emergencyContact: "Ana Santos",
          emergencyContactPhone: "+92-301-7777777",
          joiningDate: new Date("2024-02-01"),
          status: "ACTIVE",
        },
      }),
    ]);
    console.log("✅ Sample employees created:", employees.length);

    // Create sample vehicles for residents
    const vehicles = await prisma.$transaction([
      prisma.vehicle.create({
        data: {
          residentId: residents[0].id,
          vehicleType: "CAR",
          make: "Toyota",
          model: "Camry",
          year: 2022,
          color: "White",
          licensePlate: "KHI-123",
          qrCode: JSON.stringify({
            type: "vehicle_entry",
            residentId: residents[0].id,
            residentName: residents[0].name,
            apartment: residents[0].apartment,
            vehicleType: "Car",
            licensePlate: "KHI-123",
            make: "Toyota",
            model: "Camry",
          }),
        },
      }),
      prisma.vehicle.create({
        data: {
          residentId: residents[1].id,
          vehicleType: "MOTORCYCLE",
          make: "Honda",
          model: "Civic",
          year: 2021,
          color: "Blue",
          licensePlate: "KHI-456",
          qrCode: JSON.stringify({
            type: "vehicle_entry",
            residentId: residents[1].id,
            residentName: residents[1].name,
            apartment: residents[1].apartment,
            vehicleType: "Motorcycle",
            licensePlate: "KHI-456",
            make: "Honda",
            model: "Civic",
          }),
        },
      }),
    ]);
    console.log("✅ Sample vehicles created:", vehicles.length);

    // Create sample maintenance bills with items
    const maintenanceBills = await prisma.$transaction([
      prisma.maintenanceBill.create({
        data: {
          residentId: residents[0].id,
          month: "JANUARY",
          year: 2024,
          amount: 2500,
          dueDate: new Date("2024-01-31"),
          status: "PAID",
          paidDate: new Date("2024-01-15"),
          items: {
            create: [
              {
                description: "Maintenance Charge",
                amount: 1500,
                type: "FIXED",
              },
              { description: "Parking Fee", amount: 500, type: "FIXED" },
              { description: "Security Charge", amount: 300, type: "FIXED" },
              { description: "Utility Charge", amount: 200, type: "VARIABLE" },
            ],
          },
        },
      }),
      prisma.maintenanceBill.create({
        data: {
          residentId: residents[1].id,
          month: "JANUARY",
          year: 2024,
          amount: 2000,
          dueDate: new Date("2024-01-31"),
          status: "PENDING",
          items: {
            create: [
              {
                description: "Maintenance Charge",
                amount: 1200,
                type: "FIXED",
              },
              { description: "Parking Fee", amount: 400, type: "FIXED" },
              { description: "Security Charge", amount: 250, type: "FIXED" },
              { description: "Utility Charge", amount: 150, type: "VARIABLE" },
            ],
          },
        },
      }),
      prisma.maintenanceBill.create({
        data: {
          residentId: residents[2].id,
          month: "JANUARY",
          year: 2024,
          amount: 2200,
          dueDate: new Date("2024-01-31"),
          status: "PENDING",
          items: {
            create: [
              {
                description: "Maintenance Charge",
                amount: 1300,
                type: "FIXED",
              },
              { description: "Parking Fee", amount: 450, type: "FIXED" },
              { description: "Security Charge", amount: 300, type: "FIXED" },
              { description: "Utility Charge", amount: 150, type: "VARIABLE" },
            ],
          },
        },
      }),
    ]);
    console.log("✅ Sample maintenance bills created:", maintenanceBills.length);

    // Create sample guests
    const guests = await prisma.$transaction([
      prisma.guest.create({
        data: {
          residentId: residents[0].id,
          guestName: "John Visitor",
          purpose: "FAMILY_VISIT",
          visitDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          timeFrom: "10:00",
          timeTo: "18:00",
          vehicleType: "CAR",
          licensePlate: "ABC-123",
          idNumber: "42101-9999999-9",
          idType: "CNIC",
          phone: "+1-234-567-8901",
          qrCode: JSON.stringify({
            type: "guest_entry",
            guestId: "G001",
            guestName: "John Visitor",
            hostApartment: residents[0].apartment,
            hostName: residents[0].name,
            purpose: "Family Visit",
            vehicleType: "Car",
            licensePlate: "ABC-123",
            validFrom: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            validUntil: new Date(
              Date.now() + 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000,
            ).toISOString(), // 8 hours later
            idNumber: "42101-9999999-9",
            idType: "CNIC",
            phone: "+1-234-567-8901",
          }),
          status: "ACTIVE",
        },
      }),
    ]);
    console.log("✅ Sample guests created:", guests.length);

    // Create sample complaints
    const complaints = await prisma.$transaction([
      prisma.complaint.create({
        data: {
          residentId: residents[0].id,
          title: "Water Leakage in Bathroom",
          category: "PLUMBING",
          status: "OPEN",
          priority: "HIGH",
          description:
            "There is a water leakage in the main bathroom. The water is coming from the shower area and causing damage to the floor.",
          images: [],
        },
      }),
      prisma.complaint.create({
        data: {
          residentId: residents[1].id,
          title: "Lift Not Working",
          category: "MAINTENANCE",
          status: "IN_PROGRESS",
          priority: "MEDIUM",
          description:
            "The main lift in Block B is not working properly. It gets stuck between floors.",
          images: [],
          adminResponse: "Technician has been assigned to check the lift.",
          responseDate: new Date(),
        },
      }),
    ]);
    console.log("✅ Sample complaints created:", complaints.length);

    // Create sample announcements
    const announcements = await prisma.$transaction([
      prisma.announcement.create({
        data: {
          title: "Water Supply Maintenance",
          type: "MAINTENANCE",
          priority: "HIGH",
          description:
            "Water supply will be interrupted on Saturday from 10 AM to 2 PM for maintenance work. Please store water accordingly.",
        },
      }),
      prisma.announcement.create({
        data: {
          title: "Community Event - Family Day",
          type: "EVENT",
          priority: "MEDIUM",
          description:
            "Join us for a family day event on Sunday at the community center. Fun activities for kids and families!",
        },
      }),
    ]);
    console.log("✅ Sample announcements created:", announcements.length);

    // Create sample gate entries
    const gateEntries = await prisma.$transaction([
      prisma.gateEntry.create({
        data: {
          type: "ENTRY",
          person: residents[0].name,
          apartment: residents[0].apartment,
          entryType: "RESIDENT",
          vehicle: "None",
          gate: "MAIN_GATE",
          method: "QR_CODE",
          residentId: residents[0].id,
        },
      }),
      prisma.gateEntry.create({
        data: {
          type: "ENTRY",
          person: "John Visitor",
          apartment: residents[0].apartment,
          entryType: "GUEST",
          vehicle: "Car (ABC-123)",
          gate: "MAIN_GATE",
          method: "QR_CODE",
          residentId: residents[0].id,
        },
      }),
    ]);
    console.log("✅ Sample gate entries created:", gateEntries.length);

    console.log("✅ Database seeding completed successfully!");

    // Print login credentials in a more readable format
    console.log("\n🔑 Login Credentials:");
    console.log("------------------------------------------------");
    console.log("| Role             | Email                        | Password     |");
    console.log("|------------------|------------------------------|--------------|");
    console.log("| Admin            | admin@residentialapp.com     | admin123     |");
    console.log("| Resident         | john.smith@example.com       | resident123  |");
    console.log("| Service Provider | ahmad.plumber@example.com    | provider123  |");
    console.log("------------------------------------------------");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });