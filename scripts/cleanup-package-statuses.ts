import prisma from '../src/config/database'

type Summary = {
  stalePendingExpired: number
  elapsedActiveExpired: number
  elapsedPausedExpired: number
  consumedMarkedCompleted: number
}

function env(name: string): string | undefined {
  const value = process.env[name]
  if (!value) return undefined
  return value.trim() || undefined
}

async function run() {
  const now = new Date()
  const studentId = env('STUDENT_ID')
  const teacherId = env('TEACHER_ID')

  const filter = {
    ...(studentId ? { student_id: studentId } : {}),
    ...(teacherId ? { teacher_id: teacherId } : {}),
  }

  console.log('\n=== PACKAGE STATUS CLEANUP ===')
  console.log('Now:', now.toISOString())
  if (studentId || teacherId) {
    console.log('Scope:', JSON.stringify(filter))
  } else {
    console.log('Scope: ALL students/teachers')
  }

  const summary: Summary = {
    stalePendingExpired: 0,
    elapsedActiveExpired: 0,
    elapsedPausedExpired: 0,
    consumedMarkedCompleted: 0,
  }

  const stalePending = await prisma.purchased_packages.updateMany({
    where: {
      ...filter,
      status: 'PENDING',
      purchased_at: {
        lt: new Date(Date.now() - 3 * 60 * 1000),
      },
    },
    data: { status: 'EXPIRED' },
  })
  summary.stalePendingExpired = stalePending.count

  const elapsedActive = await prisma.purchased_packages.updateMany({
    where: {
      ...filter,
      status: 'ACTIVE',
      expires_at: { lt: now },
    },
    data: { status: 'EXPIRED' },
  })
  summary.elapsedActiveExpired = elapsedActive.count

  const elapsedPaused = await prisma.purchased_packages.updateMany({
    where: {
      ...filter,
      status: 'PAUSED',
      expires_at: { lt: now },
    },
    data: { status: 'EXPIRED' },
  })
  summary.elapsedPausedExpired = elapsedPaused.count

  const consumed = await prisma.purchased_packages.updateMany({
    where: {
      ...filter,
      status: { in: ['ACTIVE', 'PAUSED'] },
      classes_remaining: { lte: 0 },
    },
    data: { status: 'COMPLETED' },
  })
  summary.consumedMarkedCompleted = consumed.count

  // classes_completed >= classes_total cannot be expressed directly in Prisma where,
  // so run a targeted SQL update for that condition.
  const rawUpdateCount = await prisma.$executeRawUnsafe(`
    UPDATE public.purchased_packages
    SET status = 'COMPLETED'
    WHERE status IN ('ACTIVE', 'PAUSED')
      AND classes_completed >= classes_total
      ${studentId ? `AND student_id = '${studentId}'::uuid` : ''}
      ${teacherId ? `AND teacher_id = '${teacherId}'::uuid` : ''}
  `)
  summary.consumedMarkedCompleted += Number(rawUpdateCount || 0)

  console.log('\nCleanup changes:')
  console.table(summary)

  const blocking = await prisma.purchased_packages.findMany({
    where: {
      ...filter,
      status: { notIn: ['CANCELLED', 'FAILED', 'EXPIRED', 'COMPLETED'] },
    },
    select: {
      id: true,
      student_id: true,
      teacher_id: true,
      status: true,
      purchased_at: true,
      expires_at: true,
      classes_total: true,
      classes_completed: true,
      classes_remaining: true,
      amount_paid: true,
      amount_remaining: true,
    },
    orderBy: [
      { student_id: 'asc' },
      { teacher_id: 'asc' },
      { purchased_at: 'desc' },
    ],
  })

  if (blocking.length === 0) {
    console.log('\n✅ No blocking packages remain (non-terminal statuses).')
  } else {
    console.log(`\n⚠️ Blocking packages still present: ${blocking.length}`)
    console.table(
      blocking.map((p) => ({
        id: p.id,
        student_id: p.student_id,
        teacher_id: p.teacher_id,
        status: p.status,
        purchased_at: p.purchased_at?.toISOString() || '',
        expires_at: p.expires_at.toISOString(),
        classes_total: p.classes_total,
        classes_completed: p.classes_completed,
        classes_remaining: p.classes_remaining,
        amount_paid: String(p.amount_paid),
        amount_remaining: String(p.amount_remaining),
      }))
    )
  }

  await prisma.$disconnect()
  console.log('\n=== DONE ===\n')
}

run().catch(async (error) => {
  console.error('\n❌ Cleanup failed:', error)
  await prisma.$disconnect()
  process.exit(1)
})
