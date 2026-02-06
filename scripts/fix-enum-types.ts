import prisma from '../src/config/database'

async function fixEnumTypes() {
  try {
    // 1. Find CHECK constraints on teacher_section_reviews
    console.log('1. Finding CHECK constraints on teacher_section_reviews...')
    const reviewConstraints = await prisma.$queryRaw<any[]>`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'public.teacher_section_reviews'::regclass 
        AND contype = 'c'
    `
    console.log('   Constraints:', JSON.stringify(reviewConstraints, null, 2))

    // 2. Find CHECK constraints on notifications
    console.log('\n2. Finding CHECK constraints on notifications...')
    const notifConstraints = await prisma.$queryRaw<any[]>`
      SELECT conname, pg_get_constraintdef(oid) as def
      FROM pg_constraint 
      WHERE conrelid = 'public.notifications'::regclass 
        AND contype = 'c'
    `
    console.log('   Constraints:', JSON.stringify(notifConstraints, null, 2))

    // 3. Check current column types
    console.log('\n3. Current column types...')
    const cols = await prisma.$queryRaw<any[]>`
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('teacher_section_reviews', 'notifications')
        AND column_name IN ('section', 'status', 'type')
      ORDER BY table_name, column_name
    `
    console.log(JSON.stringify(cols, null, 2))

    // 4. Drop CHECK constraints on teacher_section_reviews
    console.log('\n4. Dropping CHECK constraints on teacher_section_reviews...')
    for (const c of reviewConstraints) {
      console.log(`   Dropping ${c.conname}...`)
      await prisma.$executeRawUnsafe(`ALTER TABLE public.teacher_section_reviews DROP CONSTRAINT "${c.conname}"`)
    }

    // 5. Drop CHECK constraints on notifications
    console.log('5. Dropping CHECK constraints on notifications...')
    for (const c of notifConstraints) {
      console.log(`   Dropping ${c.conname}...`)
      await prisma.$executeRawUnsafe(`ALTER TABLE public.notifications DROP CONSTRAINT "${c.conname}"`)
    }

    // 6. Convert teacher_section_reviews columns to enum types
    console.log('\n6. Converting teacher_section_reviews.section to section_type enum...')
    await prisma.$executeRaw`
      ALTER TABLE public.teacher_section_reviews 
        ALTER COLUMN section TYPE public.section_type USING section::public.section_type
    `
    console.log('   ✅ section column converted')

    console.log('   Converting teacher_section_reviews.status to review_status enum...')
    await prisma.$executeRaw`
      ALTER TABLE public.teacher_section_reviews 
        ALTER COLUMN status TYPE public.review_status USING status::public.review_status
    `
    console.log('   ✅ status column converted')

    // 7. Set default for status
    console.log('\n7. Setting default for status column...')
    await prisma.$executeRaw`
      ALTER TABLE public.teacher_section_reviews 
        ALTER COLUMN status SET DEFAULT 'draft'::public.review_status
    `
    console.log('   ✅ default set')

    // 8. Verify final state
    console.log('\n8. Verifying final column types...')
    const finalCols = await prisma.$queryRaw<any[]>`
      SELECT table_name, column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name IN ('teacher_section_reviews', 'notifications')
      ORDER BY table_name, ordinal_position
    `
    console.log(JSON.stringify(finalCols, null, 2))

    console.log('\n✅ All fixes applied successfully!')
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixEnumTypes()
