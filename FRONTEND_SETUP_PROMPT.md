

I need you to build a complete Next.js frontend for a music learning platform called Maestra. Here are the requirements:

### Tech Stack
- **Next.js 14+** with App Router (not Pages Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** for styling
- **Supabase Auth** for authentication
- **shadcn/ui** for UI components
- **React Hook Form** + **Zod** for form validation
- **Tanstack Query (React Query)** for API calls

### Backend Integration
The backend is already built and running at `http://localhost:4000`. Here are the key endpoints:

**Auth Endpoints:**
- `POST /api/v1/auth/register` - Create user profile (requires Supabase JWT)
- `GET /api/v1/auth/me` - Get current user

**Teacher Endpoints:**
- `POST /api/v1/teachers/onboard` - Complete teacher onboarding
- `GET /api/v1/teachers/profile/me` - Get own teacher profile
- `PUT /api/v1/teachers/profile` - Update teacher profile
- `GET /api/v1/teachers` - Get all teachers (public)

### Environment Variables (.env.local)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://sojdmotuicmshiodtytf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvamRtb3R1aWNtc2hpb2R0eXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU5MzMsImV4cCI6MjA4MjA4MTkzM30.VuibR1l2oasru7V8_Tn-JDEitl-H7_5lBWGNrIHYDeM

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Required Pages & Features

#### 1. Authentication Pages
- `/auth/login` - Login page with email/password
- `/auth/signup` - Signup page with role selection (teacher/student)
- `/auth/callback` - Supabase auth callback handler

**Auth Flow:**
1. User signs up via Supabase Auth
2. After signup, automatically call `POST /api/v1/auth/register` with role
3. Store Supabase session in cookies/local storage
4. Include JWT token in all API requests as `Authorization: Bearer {token}`

#### 2. Teacher Dashboard (`/teacher/dashboard`)
Protected route - only accessible after login with teacher role.

**Dashboard Sections:**
- **Welcome Header** - Display teacher name and verification status
- **Profile Completion** - If not onboarded, show prompt to complete profile
- **Stats Cards** - Placeholder for future metrics (total students, upcoming classes, earnings)
- **Quick Actions** - Links to key features

#### 3. Teacher Onboarding (`/teacher/onboarding`)
Multi-step form for teachers to complete their profile. Only show if teacher hasn't completed onboarding.

**Form Fields:**
- Bio (textarea, 50-1000 characters, required)
- Instruments (multi-select, required) - Options: Piano, Guitar, Violin, Drums, Vocals, Flute, Saxophone, etc.
- Genres (multi-select, required) - Options: Classical, Jazz, Rock, Pop, Blues, Country, Electronic, etc.
- Experience Years (number, 0-70, required)
- Hourly Rate (number, optional)
- Location (text, optional)
- Timezone (dropdown, optional) - Use standard timezone list

**Validation:** Use Zod schema matching backend validation
**Submission:** POST to `/api/v1/teachers/onboard`
**Success:** Redirect to `/teacher/dashboard`

#### 4. Teacher Profile (`/teacher/profile`)
View and edit teacher profile.

**Features:**
- Display current profile information
- Edit mode with form (same fields as onboarding)
- Save changes (PUT to `/api/v1/teachers/profile`)
- Show verification badge if verified

### Technical Requirements

#### 1. Supabase Setup
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

#### 2. API Client
Create an axios instance or fetch wrapper that:
- Automatically includes Authorization header with Supabase token
- Handles token refresh
- Has proper error handling
- Returns typed responses

Example:
```typescript
// lib/api/client.ts
const getToken = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

export const apiClient = {
  get: async (url) => {
    const token = await getToken()
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  },
  // ... post, put, delete
}
```

#### 3. Protected Routes
Create middleware or route protection:
- Check if user is authenticated (Supabase session exists)
- Check if profile exists in backend (call `/api/v1/auth/me`)
- Redirect to login if not authenticated
- Redirect to onboarding if teacher hasn't completed profile

#### 4. shadcn/ui Components Needed
Install and use these components:
- `Button`
- `Card`
- `Form` (with react-hook-form)
- `Input`
- `Textarea`
- `Select`
- `Badge`
- `Avatar`
- `Separator`
- `Skeleton` (for loading states)

### Styling Requirements
- Clean, modern design with good spacing
- Responsive (mobile-first)
- Use Tailwind CSS utilities
- Dark mode support (optional but nice to have)
- Consistent color scheme (primary: blue/purple, secondary: gray)

### Error Handling
- Display user-friendly error messages
- Handle network errors gracefully
- Show loading states during API calls
- Toast notifications for success/error (use sonner or react-hot-toast)

### Code Quality
- TypeScript types for all API responses
- Proper error boundaries
- Loading and empty states
- Form validation with clear error messages
- Clean component structure
- Reusable API hooks (useAuth, useTeacher, etc.)

### Setup Instructions I Need
1. Complete project setup commands (npx create-next-app, dependencies)
2. All necessary file creations (in order)
3. Configuration files (tailwind.config, tsconfig, etc.)
4. Folder structure best practices
5. Step-by-step implementation

### Testing Flow
After setup, I should be able to:
1. Run `npm run dev`
2. Go to `/auth/signup`
3. Sign up as a teacher
4. Get redirected to `/teacher/onboarding`
5. Complete onboarding form
6. Get redirected to `/teacher/dashboard`
7. See my profile data
8. Navigate to `/teacher/profile` and update my info

Please guide me through setting this up step by step, creating all necessary files and configurations.

## PROMPT END

---

**Additional Notes:**
- The backend expects the JWT token from Supabase in the Authorization header
- All protected endpoints require authentication
- Teacher onboarding is a one-time process (can't onboard twice)
- Profile updates are unlimited
- Backend handles all validation - frontend should mirror those rules

**Backend Validation Rules to Mirror:**
- Bio: 50-1000 characters
- Instruments: Array of strings, at least 1
- Genres: Array of strings, at least 1
- Experience Years: Number between 0-70
- Hourly Rate: Positive number (if provided)
