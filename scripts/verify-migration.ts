import prisma from '../src/config/database'

async function verifyMigration() {
  console.log('=== VERIFYING SECTION REVIEWS & NOTIFICATIONS MIGRATION ===\n')

  // 1. Check teacher_section_reviews table exists and columns are correct
  console.log('1. Checking teacher_section_reviews table structure...')
  const reviewColumns = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_section_reviews'
    ORDER BY ordinal_position
  `
  if (reviewColumns.length === 0) {
    console.log('   ❌ teacher_section_reviews table NOT FOUND!')
  } else {
    console.log(`   ✅ Table exists with ${reviewColumns.length} columns:`)
    reviewColumns.forEach(c => console.log(`      - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`))
  }

  // 2. Check notifications table
  console.log('\n2. Checking notifications table structure...')
  const notifColumns = await prisma.$queryRaw<any[]>`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'notifications'
    ORDER BY ordinal_position
  `
  if (notifColumns.length === 0) {
    console.log('   ❌ notifications table NOT FOUND!')
  } else {
    console.log(`   ✅ Table exists with ${notifColumns.length} columns:`)
    notifColumns.forEach(c => console.log(`      - ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`))
  }

  // 3. Check unique constraint on teacher_section_reviews
  console.log('\n3. Checking constraints...')
  const constraints = await prisma.$queryRaw<any[]>`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'teacher_section_reviews'
  `
  constraints.forEach(c => console.log(`   - ${c.constraint_name} (${c.constraint_type})`))

  // 4. Check indexes
  console.log('\n4. Checking indexes...')
  const indexes = await prisma.$queryRaw<any[]>`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename IN ('teacher_section_reviews', 'notifications')
  `
  indexes.forEach(i => console.log(`   - ${i.indexname} on ${i.tablename}`))

  // 5. Check foreign key references
  console.log('\n5. Checking foreign keys...')
  const fks = await prisma.$queryRaw<any[]>`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN ('teacher_section_reviews', 'notifications')
  `
  fks.forEach(fk => console.log(`   - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}`))

  // 6. Test Prisma CRUD operations
  console.log('\n6. Testing Prisma ORM connectivity...')
  
  // Get a real teacher ID to test with
  const teacher = await prisma.teachers.findFirst({ select: { id: true, name: true } })
  if (!teacher) {
    console.log('   ⚠️  No teachers found in DB - skipping CRUD test')
  } else {
    console.log(`   Using teacher: ${teacher.name} (${teacher.id})`)

    // Test: Create a section review
    try {
      const review = await prisma.teacher_section_reviews.upsert({
        where: { teacher_id_section: { teacher_id: teacher.id, section: 'profile' } },
        update: {},
        create: {
          teacher_id: teacher.id,
          section: 'profile',
          status: 'draft',
        },
      })
      console.log(`   ✅ teacher_section_reviews CREATE/UPSERT works (id: ${review.id})`)

      // Test: Read back
      const found = await prisma.teacher_section_reviews.findUnique({
        where: { teacher_id_section: { teacher_id: teacher.id, section: 'profile' } },
      })
      console.log(`   ✅ teacher_section_reviews READ works (status: ${found?.status})`)

      // Test: Include relation (teacher → section_reviews)
      const teacherWithReviews = await prisma.teachers.findUnique({
        where: { id: teacher.id },
        include: { teacher_section_reviews: true },
      })
      console.log(`   ✅ Teacher → section_reviews RELATION works (${teacherWithReviews?.teacher_section_reviews.length} review(s))`)

      // Cleanup test review
      await prisma.teacher_section_reviews.delete({ where: { id: review.id } })
      console.log(`   ✅ teacher_section_reviews DELETE works`)
    } catch (e: any) {
      console.log(`   ❌ teacher_section_reviews CRUD failed: ${e.message}`)
    }

    // Test notifications
    try {
      const notif = await prisma.notifications.create({
        data: {
          teacher_id: teacher.id,
          title: 'Test notification',
          message: 'This is a test notification for migration verification',
          type: 'info',
          section: 'profile',
        },
      })
      console.log(`   ✅ notifications CREATE works (id: ${notif.id})`)

      // Test: Read with filter
      const unread = await prisma.notifications.findMany({
        where: { teacher_id: teacher.id, is_read: false },
      })
      console.log(`   ✅ notifications READ works (${unread.length} unread)`)

      // Test: Count
      const count = await prisma.notifications.count({
        where: { teacher_id: teacher.id, is_read: false },
      })
      console.log(`   ✅ notifications COUNT works (${count} unread)`)

      // Test: Include relation (teacher → notifications)
      const teacherWithNotifs = await prisma.teachers.findUnique({
        where: { id: teacher.id },
        include: { notifications: true },
      })
      console.log(`   ✅ Teacher → notifications RELATION works (${teacherWithNotifs?.notifications.length} notification(s))`)

      // Test: Update (mark as read)
      await prisma.notifications.update({
        where: { id: notif.id },
        data: { is_read: true },
      })
      console.log(`   ✅ notifications UPDATE works`)

      // Cleanup
      await prisma.notifications.delete({ where: { id: notif.id } })
      console.log(`   ✅ notifications DELETE works`)
    } catch (e: any) {
      console.log(`   ❌ notifications CRUD failed: ${e.message}`)
    }
  }

  // 7. Test the unique constraint enforcement
  console.log('\n7. Testing unique constraint enforcement...')
  if (teacher) {
    try {
      // Create two reviews for same teacher+section - should fail on second
      await prisma.teacher_section_reviews.create({
        data: { teacher_id: teacher.id, section: 'pricing', status: 'draft' },
      })
      try {
        await prisma.teacher_section_reviews.create({
          data: { teacher_id: teacher.id, section: 'pricing', status: 'draft' },
        })
        console.log('   ❌ Unique constraint NOT enforced - duplicates allowed!')
      } catch (e: any) {
        if (e.code === 'P2002') {
          console.log('   ✅ Unique constraint (teacher_id, section) enforced correctly')
        } else {
          console.log(`   ⚠️  Unexpected error: ${e.message}`)
        }
      }
      // Cleanup
      await prisma.teacher_section_reviews.deleteMany({ where: { teacher_id: teacher.id } })
    } catch (e: any) {
      console.log(`   ❌ Constraint test failed: ${e.message}`)
    }
  }

  console.log('\n=== VERIFICATION COMPLETE ===')
  await prisma.$disconnect()
}

verifyMigration().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
