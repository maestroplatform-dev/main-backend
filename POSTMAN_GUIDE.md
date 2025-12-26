# 🧪 Postman Testing Guide - Teacher Onboarding

## Step 1: Sign Up via Frontend

1. **Go to your frontend** (http://localhost:3000)
2. **Sign up with Supabase**:
   - Use email/password
   - Example: `teacher@test.com` / `password123`
3. **Open Browser Console** (F12 → Console)
4. **Get your token**:
   ```javascript
   // Run this in console
   const { data } = await supabase.auth.getSession()
   console.log(data.session.access_token)
   ```
5. **Copy the token** - it looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## Step 2: Set Up Postman

### Create Environment Variables
1. Open Postman → Environments → Create New Environment
2. Name it: `Maestra Local`
3. Add variables:
   - `base_url`: `http://localhost:4000`
   - `token`: `[paste your token here]`

### Select the Environment
Click the dropdown in top-right → Select "Maestra Local"

---

## Step 3: Test API Endpoints

### 📝 **1. Register User Profile**

**Request:**
```
POST {{base_url}}/api/v1/auth/register
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "role": "teacher"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "message": "Profile created successfully",
    "profile": {
      "id": "uuid...",
      "role": "teacher",
      "is_active": true,
      "created_at": "2025-12-25T..."
    },
    "email": "teacher@test.com"
  }
}
```

---

### 👤 **2. Get Current User**

**Request:**
```
GET {{base_url}}/api/v1/auth/me
```

**Headers:**
```
Authorization: Bearer {{token}}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid...",
    "role": "teacher",
    "is_active": true,
    "created_at": "2025-12-25T...",
    "teachers": {
      "id": "uuid...",
      "bio": null,
      "experience_years": null,
      "verified": false,
      "created_at": "2025-12-25T..."
    }
  }
}
```

---

### 🎓 **3. Complete Teacher Onboarding**

**Request:**
```
POST {{base_url}}/api/v1/teachers/onboard
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "bio": "Professional piano teacher with over 10 years of experience teaching students of all ages and skill levels. Specialized in classical and jazz piano.",
  "instruments": ["Piano", "Keyboard"],
  "genres": ["Classical", "Jazz", "Contemporary"],
  "experience_years": 10,
  "hourly_rate": 75,
  "location": "New York, NY",
  "timezone": "America/New_York"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "data": {
    "message": "Teacher onboarding completed",
    "teacher": {
      "id": "uuid...",
      "bio": "Professional piano teacher...",
      "experience_years": 10,
      "verified": false,
      "created_at": "2025-12-25T..."
    }
  }
}
```

---

### 📖 **4. Get Own Profile**

**Request:**
```
GET {{base_url}}/api/v1/teachers/profile/me
```

**Headers:**
```
Authorization: Bearer {{token}}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid...",
    "bio": "Professional piano teacher...",
    "experience_years": 10,
    "verified": false,
    "created_at": "2025-12-25T...",
    "profile": {
      "id": "uuid...",
      "role": "teacher",
      "is_active": true
    },
    "packages": [],
    "reviews": []
  }
}
```

---

### ✏️ **5. Update Profile**

**Request:**
```
PUT {{base_url}}/api/v1/teachers/profile
```

**Headers:**
```
Authorization: Bearer {{token}}
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "bio": "Updated bio with more details about teaching methodology and achievements.",
  "experience_years": 12
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully",
    "teacher": {
      "id": "uuid...",
      "bio": "Updated bio...",
      "experience_years": 12,
      ...
    }
  }
}
```

---

### 📋 **6. Get All Teachers (Public)**

**Request:**
```
GET {{base_url}}/api/v1/teachers?limit=10&offset=0
```

**Headers:**
```
(No auth required - public endpoint)
```

**Expected Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid...",
      "bio": "Professional piano teacher...",
      "experience_years": 10,
      "verified": false,
      "profile": {
        "id": "uuid...",
        "role": "teacher",
        "is_active": true
      },
      "packages": []
    }
  ],
  "meta": {
    "limit": 10,
    "offset": 0,
    "count": 1
  }
}
```

---

## 🔄 Token Refresh

**Your token expires after 1 hour.** When it expires:

1. Run this in frontend console:
   ```javascript
   const { data } = await supabase.auth.refreshSession()
   console.log(data.session.access_token)
   ```
2. Update `token` variable in Postman environment

---

## ❌ Common Errors

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Invalid token",
    "code": "INVALID_TOKEN"
  }
}
```
**Solution:** Get a fresh token from Supabase

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "message": "Insufficient permissions",
    "code": "FORBIDDEN"
  }
}
```
**Solution:** User role doesn't match required role (e.g., student trying teacher endpoint)

### 409 Conflict
```json
{
  "success": false,
  "error": {
    "message": "Profile already exists",
    "code": "PROFILE_EXISTS"
  }
}
```
**Solution:** You already registered, skip to next step

---

## 📝 Testing Checklist

- [ ] Sign up via frontend
- [ ] Copy JWT token from console
- [ ] Add token to Postman environment
- [ ] POST /auth/register (create profile)
- [ ] GET /auth/me (verify profile created)
- [ ] POST /teachers/onboard (complete onboarding)
- [ ] GET /teachers/profile/me (check onboarded data)
- [ ] PUT /teachers/profile (update profile)
- [ ] GET /teachers (view public list)

---

## 🎯 Quick Test Script

Run this in Supabase SQL Editor to check data:

```sql
-- Check profiles
SELECT * FROM profiles;

-- Check teachers
SELECT * FROM teachers;

-- Join to see full teacher data
SELECT 
  p.id,
  p.role,
  t.bio,
  t.experience_years,
  t.verified
FROM profiles p
LEFT JOIN teachers t ON p.id = t.id
WHERE p.role = 'teacher';
```

Happy Testing! 🚀
