# Residential Management System - Backend API

This is the backend API for the Residential Management System built with Node.js, Express, TypeScript, and Prisma with PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth for Admin, Residents, Service Providers, and Employees
- **Complete CRUD Operations**: For all entities (residents, guests, vehicles, bills, complaints, etc.)
- **QR Code Support**: Generate and validate QR codes for gate access
- **Real-time Data**: Live updates for all panels
- **Role-based Access Control**: Different permissions for different user types
- **Database Relations**: Proper foreign key relationships and data integrity

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database
2. Update the `DATABASE_URL` in `.env` file:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/residential_management?schema=public"
```

### 3. Environment Configuration

Update the `.env` file with your settings:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/residential_management?schema=public"

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-here-change-in-production
JWT_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. Generate Prisma Client and Run Migrations

```bash
npm run db:generate
npm run db:push
```

### 5. Seed the Database

```bash
npm run db:seed
```

This will create sample data including:

- Admin user
- Sample residents
- Service providers
- Employees
- Maintenance bills
- Guests
- Vehicles
- And more...

### 6. Start the Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## Default Login Credentials

After seeding, you can use these credentials:

### Admin

- Username: `admin`
- Password: `admin123`

### Resident

- Email: `john.smith@example.com`
- Password: `resident123`

### Service Provider

- Email: `ahmad.plumber@example.com`
- Password: `provider123`

## API Endpoints

### Authentication

- `POST /api/auth/admin/login` - Admin login
- `POST /api/auth/resident/login` - Resident login
- `POST /api/auth/resident/register` - Resident registration
- `POST /api/auth/service-provider/login` - Service provider login
- `POST /api/auth/service-provider/register` - Service provider registration
- `GET /api/auth/me` - Get current user

### Residents

- `GET /api/residents` - Get all residents (Admin only)
- `GET /api/residents/:id` - Get resident by ID
- `PATCH /api/residents/:id` - Update resident
- `PATCH /api/residents/:id/approval` - Approve/reject resident (Admin only)

### Service Providers

- `GET /api/service-providers` - Get all service providers
- `GET /api/service-providers/:id` - Get service provider by ID
- `PATCH /api/service-providers/:id` - Update service provider
- `PATCH /api/service-providers/:id/approval` - Update status (Admin only)

### Employees

- `GET /api/employees` - Get all employees (Admin only)
- `POST /api/employees` - Create employee (Admin only)
- `GET /api/employees/:id/qr-code` - Generate employee QR code

### Guests

- `GET /api/guests` - Get guests (filtered by user type)
- `POST /api/guests` - Register new guest
- `GET /api/guests/:id/qr-code` - Get guest QR code
- `PATCH /api/guests/:id/status` - Update guest status

### Maintenance Bills

- `GET /api/maintenance-bills` - Get bills (filtered by user type)
- `POST /api/maintenance-bills/generate` - Generate bills (Admin only)
- `PATCH /api/maintenance-bills/:id/status` - Update bill status (Admin only)
- `PATCH /api/maintenance-bills/:id/mark-paid` - Mark bill as paid

### Gate Entries

- `GET /api/gate-entries` - Get all gate entries (Admin only)
- `POST /api/gate-entries/qr-scan` - Process QR code scan (Admin only)
- `GET /api/gate-entries/stats/today` - Get today's statistics

### Dashboard

- `GET /api/dashboard/admin/stats` - Admin dashboard statistics
- `GET /api/dashboard/resident/stats` - Resident dashboard statistics
- `GET /api/dashboard/service-provider/stats` - Service provider dashboard statistics

## QR Code Types Supported

### Guest Entry

```json
{
  "type": "guest_entry",
  "guestId": "G123",
  "guestName": "John Visitor",
  "hostApartment": "A-101",
  "hostName": "John Smith",
  "purpose": "Family Visit",
  "vehicleType": "Car",
  "licensePlate": "ABC-123",
  "validFrom": "2024-01-15T10:00:00",
  "validUntil": "2024-01-15T18:00:00",
  "idNumber": "12345",
  "idType": "CNIC",
  "phone": "+1234567890"
}
```

### Resident Entry

```json
{
  "type": "resident_entry",
  "residentId": 1,
  "residentName": "John Smith",
  "apartment": "A-101",
  "phone": "+1234567890",
  "status": "Active"
}
```

### Vehicle Entry

```json
{
  "type": "vehicle_entry",
  "residentId": 1,
  "residentName": "John Smith",
  "apartment": "A-101",
  "vehicleType": "Car",
  "licensePlate": "ABC-123",
  "make": "Toyota",
  "model": "Camry"
}
```

### Employee Entry

```json
{
  "type": "employee_entry",
  "employeeId": "EMP001",
  "employeeName": "Ahmad Khan",
  "designation": "Security Guard",
  "department": "Security",
  "status": "Active"
}
```

## Database Schema

The system uses PostgreSQL with Prisma ORM. Key entities include:

- **Admin**: System administrators
- **Resident**: Building residents with full KYC
- **ServiceProvider**: Service providers with ratings and reviews
- **Employee**: Building staff and employees
- **Guest**: Temporary visitors with time-based access
- **Vehicle**: Resident and service provider vehicles
- **MaintenanceBill**: Monthly maintenance bills with itemized charges
- **Complaint**: Resident complaints with status tracking
- **ServiceBooking**: Service provider bookings and reviews
- **GateEntry**: Entry/exit logs from QR code scans
- **Announcement**: Building announcements

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Different permissions for each user type
- **Password Hashing**: BCrypt for secure password storage
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Zod schemas for all inputs
- **CORS Protection**: Configured for specific origins
- **Helmet**: Security headers middleware

## Development

### Build for Production

```bash
npm run build
npm start
```

### Database Operations

```bash
npm run db:generate    # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:migrate    # Run migrations
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed database with sample data
```

### Health Check

Visit `http://localhost:3001/health` to check if the API is running.

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure production database
4. Set up proper CORS origins
5. Use environment variables for all secrets
6. Set up proper logging and monitoring
7. Use a process manager like PM2

## Support

For any issues or questions, please check the API logs and ensure all environment variables are properly configured.
