import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)

const API_URL = process.env.API_URL || 'http://localhost:4000'

async function createTeacher() {
  try {
    console.log('🎓 Creating teacher account...\n')

    // Step 1: Sign up with Supabase
    console.log('1️⃣ Signing up with Supabase...')
    const email = `teacher${Date.now()}@example.com`
    const password = 'password123'

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      console.error('❌ Signup error:', signUpError.message)
      return
    }

    if (!signUpData.session) {
      console.error('❌ No session returned. Check if email confirmation is required.')
      return
    }

    const token = signUpData.session.access_token
    console.log('✅ Signed up successfully!')
    console.log('   Email:', email)
    console.log('   Password:', password)
    console.log('   Token:', token.substring(0, 20) + '...\n')

    // Step 2: Register profile in backend
    console.log('2️⃣ Registering profile in backend...')
    const registerResponse = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'teacher' }),
    })

    const registerData = await registerResponse.json() as any

    if (!registerResponse.ok) {
      console.error('❌ Registration failed:', registerData)
      return
    }

    console.log('✅ Profile registered!')
    console.log('   Profile ID:', registerData.data.profile.id)
    console.log('   Role:', registerData.data.profile.role, '\n')

    // Step 3: Complete teacher onboarding
    console.log('3️⃣ Completing teacher onboarding...')
    const onboardingResponse = await fetch(`${API_URL}/api/v1/teachers/onboard`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bio: 'Professional piano teacher with over 10 years of experience teaching students of all ages and skill levels. Specialized in classical and jazz piano.',
        instruments: ['Piano', 'Keyboard'],
        genres: ['Classical', 'Jazz', 'Contemporary'],
        experience_years: 10,
        hourly_rate: 75,
        location: 'New York, NY',
        timezone: 'America/New_York',
      }),
    })

    const onboardingData = await onboardingResponse.json() as any

    if (!onboardingResponse.ok) {
      console.error('❌ Onboarding failed:', onboardingData)
      return
    }

    console.log('✅ Teacher onboarding completed!')
    console.log('   Teacher ID:', onboardingData.data.teacher.id)
    console.log('   Experience:', onboardingData.data.teacher.experience_years, 'years\n')

    // Step 4: Fetch complete profile
    console.log('4️⃣ Fetching complete profile...')
    const profileResponse = await fetch(`${API_URL}/api/v1/teachers/profile/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    const profileData = await profileResponse.json() as any

    if (!profileResponse.ok) {
      console.error('❌ Failed to fetch profile:', profileData)
      return
    }

    console.log('✅ Profile fetched successfully!\n')
    console.log('============================================================')
    console.log('🎉 TEACHER CREATED SUCCESSFULLY!')
    console.log('============================================================')
    console.log('📧 Email:', email)
    console.log('🔑 Password:', password)
    console.log('🆔 ID:', profileData.data.id)
    console.log('👤 Bio:', profileData.data.bio?.substring(0, 50) + '...')
    console.log('🎹 Instruments:', profileData.data.instruments?.join(', ') || 'N/A')
    console.log('🎵 Genres:', profileData.data.genres?.join(', ') || 'N/A')
    console.log('📅 Experience:', profileData.data.experience_years, 'years')
    console.log('✅ Verified:', profileData.data.verified)
    console.log('============================================================\n')

    console.log('🔐 Use these credentials to login:')
    console.log('   Email:', email)
    console.log('   Password:', password)
    console.log('\n💡 JWT Token for API testing:')
    console.log('   ', token)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

createTeacher()
