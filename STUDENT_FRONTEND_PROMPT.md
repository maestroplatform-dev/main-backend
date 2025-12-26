

I need you to build a complete Next.js student-facing frontend for a music learning platform called Maestra. Here are the requirements:

### Tech Stack
- **Next.js ** with App Router (not Pages Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** for styling
- **Supabase Auth** for authentication
- **shadcn/ui** for UI components
- **React Hook Form** + **Zod** for form validation
- **Tanstack Query (React Query)** for API calls
- **React Calendar** or similar for booking interface

### Backend Integration
The backend is already built and running at `http://localhost:4000`. Here are the key endpoints:

**Auth Endpoints:**
- `POST /api/v1/auth/register` - Create user profile (requires Supabase JWT)
- `GET /api/v1/auth/me` - Get current user

**Teacher Endpoints (Public):**
- `GET /api/v1/teachers` - Get all verified teachers (public)
- `GET /api/v1/teachers/:id` - Get specific teacher details

**Student Endpoints (To be implemented or placeholder):**
- `GET /api/v1/students/profile/me` - Get own student profile
- `PUT /api/v1/students/profile` - Update student profile
- `GET /api/v1/students/bookings` - Get student's bookings
- `POST /api/v1/students/bookings` - Create new booking
- `GET /api/v1/students/packages` - Get purchased packages
- `POST /api/v1/students/reviews` - Leave a review for teacher

### Environment Variables (.env.local)
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://sojdmotuicmshiodtytf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvamRtb3R1aWNtc2hpb2R0eXRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MDU5MzMsImV4cCI6MjA4MjA4MTkzM30.VuibR1l2oasru7V8_Tn-JDEitl-H7_5lBWGNrIHYDeM

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:4000

# Stripe (for future payment integration)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

### Required Pages & Features

#### 1. Authentication Pages
- `/auth/login` - Login page with email/password
- `/auth/signup` - Signup page (automatically set role as "student")
- `/auth/callback` - Supabase auth callback handler

**Auth Flow:**
1. User signs up via Supabase Auth
2. After signup, automatically call `POST /api/v1/auth/register` with `role: "student"`
3. Store Supabase session in cookies/local storage
4. Include JWT token in all API requests as `Authorization: Bearer {token}`

#### 2. Student Dashboard (`/student/dashboard` or just `/dashboard`)
Protected route - only accessible after login with student role.

**Dashboard Sections:**
- **Welcome Header** - Display student name and profile picture
- **Upcoming Classes** - List of upcoming bookings with teacher info
- **Recent Activity** - Recent bookings, package purchases
- **Quick Stats** - Total classes taken, hours learned, favorite instruments
- **Recommended Teachers** - Personalized teacher recommendations based on interests

#### 3. Browse Teachers (`/teachers`)
Public or protected route showing all available teachers.

**Features:**
- **Search & Filters:**
  - Search by name
  - Filter by instrument (Piano, Guitar, Violin, Drums, Vocals, etc.)
  - Filter by genre (Classical, Jazz, Rock, Pop, etc.)
  - Filter by price range
  - Filter by experience level
  - Sort by: Rating, Price (low to high), Experience

- **Teacher Cards:**
  - Profile picture
  - Name
  - Instruments & Genres (badges)
  - Experience years
  - Hourly rate
  - Average rating (stars)
  - Verified badge if verified
  - "View Profile" button

- **Pagination** - Show 12 teachers per page

#### 4. Teacher Profile (`/teachers/[id]`)
Detailed view of a specific teacher.

**Sections:**
- **Header:**
  - Large profile picture
  - Name, verified badge
  - Rating (stars) and number of reviews
  - Instruments & Genres badges
  - Experience years
  - Hourly rate
  - "Book a Class" CTA button

- **About:**
  - Full bio
  - Teaching philosophy
  - Specializations

- **Packages:**
  - List of class packages offered
  - Package name, description, price, number of classes
  - "Purchase" button for each

- **Availability:**
  - Calendar view showing available time slots
  - Timezone display
  - "Book a Slot" interface

- **Reviews:**
  - List of student reviews
  - Rating, comment, date
  - Student name (or anonymous)
  - Pagination for reviews

#### 5. Booking Page (`/teachers/[id]/book`)
Book a class with a specific teacher.

**Form Fields:**
- **Date Picker** - Select date from teacher's availability
- **Time Slot** - Select available time slot
- **Duration** - Select duration (30 min, 45 min, 60 min, 90 min)
- **Package Selection** - Use credits from purchased package or pay per class
- **Notes** - Optional notes for the teacher (instrument to bring, focus areas, etc.)

**Booking Flow:**
1. Check if student has available package credits
2. If yes, show package selection
3. If no, redirect to payment for single class
4. Confirm booking details
5. Submit booking
6. Show confirmation with calendar invite option

#### 6. My Bookings (`/student/bookings`)
View all bookings (upcoming, past, cancelled).

**Features:**
- **Tabs:** Upcoming | Past | Cancelled
- **Booking Cards:**
  - Teacher info (name, picture)
  - Date & time
  - Duration
  - Instrument/focus
  - Status badge
  - Actions: Cancel (for upcoming), Review (for past), Reschedule

- **Filters:**
  - Date range
  - Teacher
  - Instrument

#### 7. My Packages (`/student/packages`)
View purchased class packages.

**Features:**
- **Active Packages:**
  - Package name
  - Teacher name
  - Classes remaining / total
  - Progress bar
  - Expiry date
  - "Book a Class" button

- **Expired Packages:**
  - Archive view
  - Purchase history

#### 8. Student Profile (`/student/profile`)
View and edit student profile.

**Profile Fields:**
- Name (from Supabase auth)
- Profile picture
- Bio (optional)
- Instruments interested in (multi-select)
- Genres interested in (multi-select)
- Skill level (Beginner, Intermediate, Advanced)
- Learning goals (textarea)
- Timezone

**Edit Mode:**
- Form validation with Zod
- Save changes (PUT to `/api/v1/students/profile`)
- Profile picture upload to Supabase Storage

#### 9. Payment/Checkout (`/checkout`)
Purchase class packages or pay for single classes.

**Features:**
- Package selection
- Price display
- Stripe payment integration
- Payment confirmation
- Redirect to booking page after purchase

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

#### 2. API Client with Auto-Auth
```typescript
// lib/api/client.ts
import { createClient } from '@/lib/supabase/client'

const getToken = async () => {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

export const apiClient = {
  get: async <T>(url: string): Promise<T> => {
    const token = await getToken()
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    if (!res.ok) throw new Error('API request failed')
    return res.json()
  },
  
  post: async <T>(url: string, data: any): Promise<T> => {
    const token = await getToken()
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('API request failed')
    return res.json()
  },
  
  put: async <T>(url: string, data: any): Promise<T> => {
    const token = await getToken()
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('API request failed')
    return res.json()
  }
}
```

#### 3. React Query Hooks
Create custom hooks for data fetching:

```typescript
// hooks/useTeachers.ts
export const useTeachers = (filters?: TeacherFilters) => {
  return useQuery({
    queryKey: ['teachers', filters],
    queryFn: () => apiClient.get<TeachersResponse>('/api/v1/teachers')
  })
}

// hooks/useTeacher.ts
export const useTeacher = (id: string) => {
  return useQuery({
    queryKey: ['teacher', id],
    queryFn: () => apiClient.get<Teacher>(`/api/v1/teachers/${id}`)
  })
}

// hooks/useBookings.ts
export const useBookings = () => {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: () => apiClient.get<Booking[]>('/api/v1/students/bookings')
  })
}
```

#### 4. Protected Routes Middleware
```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: Request) {
  const supabase = createServerClient(...)
  const { data: { session } } = await supabase.auth.getSession()
  
  // Protect student routes
  if (request.nextUrl.pathname.startsWith('/student')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
    
    // Verify user is a student (call backend /api/v1/auth/me)
    // If teacher, redirect to teacher dashboard
  }
  
  return NextResponse.next()
}
```

#### 5. shadcn/ui Components Needed
Install and use these components:
- `Button`
- `Card`
- `Form` (with react-hook-form)
- `Input`
- `Textarea`
- `Select`
- `Badge`
- `Avatar`
- `Calendar`
- `Dialog` (for modals)
- `Tabs`
- `Separator`
- `Skeleton` (for loading states)
- `Alert`
- `Toast` (for notifications)
- `Popover`
- `Command` (for search/filter)

### Styling Requirements
- Clean, modern, user-friendly design
- Responsive (mobile-first approach)
- Beautiful teacher cards with hover effects
- Smooth transitions and animations
- Consistent color scheme:
  - Primary: Blue (#3B82F6) for trust and professionalism
  - Secondary: Purple (#8B5CF6) for creativity
  - Success: Green (#10B981) for confirmations
  - Warning: Orange (#F59E0B) for alerts
- Dark mode support (optional)

### Additional Features

#### Search & Filter System
- Debounced search input
- Multi-select filters with checkboxes
- Clear all filters button
- Filter count badges
- URL state management (filters persist in URL)

#### Rating System
- Star rating component (read-only for display, interactive for reviews)
- Average rating calculation
- Review submission form
- Review moderation status

#### Calendar/Booking System
- Weekly calendar view
- Daily time slots (15-minute intervals)
- Booked slots shown as disabled
- Teacher's timezone conversion
- iCal/Google Calendar integration for confirmed bookings

#### Notification System
- Toast notifications for:
  - Booking confirmations
  - Payment success/failure
  - Profile updates
  - Booking reminders (1 day before, 1 hour before)

### TypeScript Types
Define these types:

```typescript
// types/teacher.ts
export interface Teacher {
  id: string
  bio: string
  experience_years: number
  verified: boolean
  hourly_rate?: number
  location?: string
  timezone?: string
  instruments: string[]
  genres: string[]
  profile: {
    id: string
    role: 'teacher'
    is_active: boolean
  }
  packages: Package[]
  reviews: Review[]
  average_rating?: number
  total_reviews?: number
}

// types/booking.ts
export interface Booking {
  id: string
  student_id: string
  teacher_id: string
  package_id?: string
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string
  teacher: {
    id: string
    bio: string
    profile: { id: string }
  }
}

// types/package.ts
export interface Package {
  id: string
  teacher_id: string
  name: string
  description?: string
  price: number
  total_classes: number
}

// types/student.ts
export interface Student {
  id: string
  bio?: string
  skill_level?: string
  learning_goals?: string
  instruments_interested: string[]
  genres_interested: string[]
  timezone?: string
  profile: {
    id: string
    role: 'student'
    is_active: boolean
  }
}
```

### Error Handling
- Network error boundaries
- User-friendly error messages
- Retry logic for failed requests
- Loading skeletons while fetching data
- Empty states for no data
- Toast notifications for errors

### Form Validation
- Client-side validation with Zod
- Real-time validation feedback
- Clear error messages
- Disabled submit buttons until valid
- Success confirmations

### Performance Optimizations
- Image optimization with Next.js Image component
- Lazy loading for teacher cards (infinite scroll or pagination)
- Route prefetching for better navigation
- React Query caching for API responses
- Debounced search inputs
- Memoized filter functions

### Accessibility
- Keyboard navigation support
- ARIA labels for interactive elements
- Focus management in modals
- Screen reader friendly
- Color contrast compliance (WCAG AA)

### Setup Instructions I Need
1. Complete project setup commands (npx create-next-app, dependencies)
2. All necessary file creations (in order of creation)
3. Configuration files (tailwind.config, tsconfig, next.config, etc.)
4. Folder structure best practices
5. Step-by-step implementation guide
6. Environment setup
7. Supabase configuration
8. shadcn/ui setup and component installation

### Testing Flow
After setup, I should be able to:
1. Run `npm run dev`
2. Go to `/auth/signup`
3. Sign up as a student
4. Get redirected to `/dashboard`
5. Browse teachers at `/teachers`
6. Click on a teacher to view profile
7. Book a class
8. View booking in `/student/bookings`
9. Update my profile at `/student/profile`
10. Leave a review for a completed class

### Bonus Features (If Time Permits)
- Video call integration (Zoom/Google Meet links in bookings)
- Chat system between students and teachers
- Practice tracking (log practice hours)
- Progress reports and analytics
- Gamification (badges, streaks, achievements)
- Social features (share progress, friend recommendations)

### Design Inspiration
- **Homepage:** Clean hero section with search bar, featured teachers
- **Teacher Cards:** Similar to Airbnb listings - image, key info, ratings
- **Teacher Profile:** Similar to Upwork freelancer profiles
- **Booking Flow:** Clean, step-by-step like Calendly
- **Dashboard:** Card-based layout like modern SaaS dashboards

Please guide me through setting this up step by step, creating all necessary files, configurations, and components in the right order.

## PROMPT END

---

**Additional Notes:**

### Backend Endpoints to be Implemented (or mock for now):
Most student endpoints may need to be built in the backend. For now, you can:
1. Create mock data for development
2. Use React Query with placeholder functions
3. Add TODO comments for backend integration
4. Focus on UI/UX first, then integrate real APIs

### Key Differences from Teacher Frontend:
- Students browse and book (consumers)
- Teachers create and offer (providers)
- Different permission levels
- Payment integration on student side
- Booking management vs. schedule management

### Integration Points:
- Same Supabase instance for auth
- Same backend API base URL
- Shared UI components between student and teacher frontends
- Consider a monorepo structure if both frontends share code

### Suggested Project Structure:
```
maestra-student-frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (student)/
│   │   ├── dashboard/
│   │   ├── bookings/
│   │   ├── packages/
│   │   └── profile/
│   ├── teachers/
│   │   ├── page.tsx (list)
│   │   └── [id]/
│   │       ├── page.tsx (profile)
│   │       └── book/
│   └── checkout/
├── components/
│   ├── ui/ (shadcn)
│   ├── teachers/
│   ├── bookings/
│   └── layout/
├── hooks/
├── lib/
│   ├── api/
│   └── supabase/
└── types/
```

Happy Building! 🎵
