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
