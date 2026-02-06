import prisma from '../src/config/database'

async function checkFlowState() {
  try {
    const result = await prisma.$queryRaw<any[]>`
      SELECT id, user_id, provider_type, authentication_method, email_optional, created_at 
      FROM auth.flow_state 
      WHERE email_optional IS NOT NULL 
      ORDER BY created_at DESC
    `
    
    console.log(`Found ${result.length} records with email_optional:\n`)
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFlowState()
