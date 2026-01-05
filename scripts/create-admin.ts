import { supabaseAdmin } from '../src/config/supabase'
import prisma from '../src/config/database'
import { randomUUID } from 'crypto'

const ADMIN_EMAIL = 'maestro.platform@gmail.com'
const ADMIN_PASSWORD = 'Maestro@Admin#2026!LOL' // Strong password
const ADMIN_NAME = 'Maestera Admin'

async function createAdmin() {
  try {
    console.log('🔵 Creating admin user...')

    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      if (authError.message.includes('already')) {
        console.log('⚠️  User already exists in Supabase auth')
        // Try to get existing user
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
        const user = existingUser.users.find((u) => u.email === ADMIN_EMAIL)
        if (!user) {
          throw new Error('User exists but could not be retrieved')
        }
        console.log('✅ Found existing Supabase user:', user.id)
        
        // Check if profile exists
        const existingProfile = await prisma.profiles.findUnique({
          where: { id: user.id },
        })

        if (existingProfile) {
          console.log('✅ Admin profile already exists')
          console.log('\n📧 Admin Credentials:')
          console.log('Email:', ADMIN_EMAIL)
          console.log('Password:', ADMIN_PASSWORD)
          console.log('\n✅ Admin setup complete!')
          return
        }

        // Create profile for existing user
        await createProfile(user.id)
        return
      }
      throw authError
    }

    if (!authData.user) {
      throw new Error('User creation failed - no user returned')
    }

    console.log('✅ Supabase user created:', authData.user.id)

    // 2. Create profile in database
    await createProfile(authData.user.id)

  } catch (error) {
    console.error('❌ Error creating admin:', error)
    process.exit(1)
  }
}

async function createProfile(userId: string) {
  try {
    const profile = await prisma.profiles.create({
      data: {
        id: userId,
        name: ADMIN_NAME,
        role: 'admin',
        is_active: true,
      },
    })

    console.log('✅ Profile created:', profile.id)

    // 3. Audit log
    const auditId = randomUUID()
    await prisma.audit_log_entries.create({
      data: {
        id: auditId,
        instance_id: null,
        payload: {
          action: 'create_admin_via_script',
          userId,
          email: ADMIN_EMAIL,
          timestamp: new Date().toISOString(),
        },
        ip_address: '127.0.0.1',
      },
    })

    console.log('✅ Audit log created')
    console.log('\n📧 Admin Credentials:')
    console.log('Email:', ADMIN_EMAIL)
    console.log('Password:', ADMIN_PASSWORD)
    console.log('\n✅ Admin setup complete!')
    console.log('\n⚠️  IMPORTANT: Store these credentials securely!')
  } catch (error) {
    console.error('❌ Error creating profile:', error)
    throw error
  }
}

createAdmin()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
