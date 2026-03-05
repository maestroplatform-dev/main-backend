# Maestra Backend API

Express.js backend for the Maestra music learning platform.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Update `.env` with your Supabase credentials:

```env
# Get from Supabase Dashboard → Settings → Database → Connection String (URI)
DATABASE_URL=postgresql://postgres.[ref]:[password]@...supabase.com:6543/postgres

# Get from Supabase Dashboard → Settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Push Database Schema
```bash
npm run prisma:push
```
This creates all tables in your Supabase database.

### 4. Start Development Server
```bash
npm run dev
```
Server runs on `http://localhost:4000`

## 📡 Test Endpoints

### Backend Health
```bash
curl http://localhost:4000/health
```

### Test Connection
```bash
curl http://localhost:4000/api/v1/test
```

### From Frontend (Next.js)
```typescript
// Test in your frontend app
const response = await fetch('http://localhost:4000/api/v1/test')
const data = await response.json()
console.log(data.data.message) // "Backend is connected! 🎉"
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:push` - Push schema to database
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## 📦 Database Tables

After running `prisma:push`, you'll have:
- `profiles` - User profiles
- `students` - Student data
- `teachers` - Teacher profiles
- `class_packages` - Class package offerings
- `purchased_packages` - Student package purchases
- `bookings` - Class bookings
- `teacher_availability` - Teacher schedules
- `payments` - Payment records
- `reviews` - Student reviews

## 🔐 API Authentication

Protected routes require a JWT token from Supabase:

```typescript
// In your frontend
const token = session?.access_token

const response = await fetch('http://localhost:4000/api/v1/protected-route', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

## 🔒 Admin creation

To prevent unauthorized admin creation, the server requires an environment secret `ADMIN_CREATION_SECRET`.

When creating a profile with role `admin`, include the header `X-Admin-Secret: <secret>` matching the server env. Example curl:

```bash
curl -H "Authorization: Bearer <token>" \
  -H "X-Admin-Secret: $ADMIN_CREATION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}' \
  http://localhost:4000/api/v1/auth/register
```

Set `ADMIN_CREATION_SECRET` in your `.env` (do not commit `.env`):

```env
ADMIN_CREATION_SECRET=your-very-secret-value
```

## 📲 WhatsApp Notifications (11za)

You can enable activity-based WhatsApp notifications for teachers and students.

```env
# Enable/disable integration
WHATSAPP_NOTIFICATIONS_ENABLED=true

# Provider selector (currently supports: 11za)
WHATSAPP_PROVIDER=11za

# 11za API endpoint and auth
WHATSAPP_11ZA_API_URL=https://api.11za.example/messages
WHATSAPP_11ZA_API_KEY=your_11za_api_key

# Optional auth header customization
WHATSAPP_11ZA_AUTH_HEADER=Authorization
WHATSAPP_11ZA_AUTH_SCHEME=Bearer

# Optional channel field in payload
WHATSAPP_11ZA_CHANNEL=whatsapp

# Optional debug mode (logs payloads, does not send)
WHATSAPP_DRY_RUN=false

# Activity template names (shared across actor for easier maintenance)
WHATSAPP_11ZA_TEMPLATE_SESSION_SCHEDULED=session_scheduled
WHATSAPP_11ZA_TEMPLATE_SESSION_RESCHEDULED=session_rescheduled

# OTP verification settings
WHATSAPP_11ZA_OTP_TEMPLATE=whatsapp_otp_verification
WHATSAPP_OTP_SECRET=replace_with_strong_random_secret
WHATSAPP_OTP_EXPIRY_MINUTES=5
WHATSAPP_OTP_MAX_ATTEMPTS=5
WHATSAPP_OTP_RESEND_COOLDOWN_SECONDS=30
WHATSAPP_OTP_DAILY_LIMIT=10
```

Current activity events wired:
- Session scheduled by teacher
- Session scheduled by student
- Session rescheduled by teacher/student
- Session cancelled by teacher/student
- Package purchased

Verification endpoints:
- `GET /api/v1/whatsapp/status`
- `POST /api/v1/whatsapp/request-otp` with `{ phone }`
- `POST /api/v1/whatsapp/verify-otp` with `{ challengeId, otp }`

WhatsApp activity messages are sent only when number is verified and opt-in is enabled.

## 🌐 CORS Configuration

Update `ALLOWED_ORIGINS` in `.env` to allow your frontend:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## 📝 Next Steps

1. Update `.env` with real Supabase credentials
2. Run `npm run prisma:push` to create database tables
3. Test endpoints from your frontend
4. Start building features (teachers, bookings, payments)
