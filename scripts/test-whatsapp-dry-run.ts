import prisma from '../src/config/database'
import { ActivityNotificationService } from '../src/services/activity-notification.service'

type VarMap = Record<string, string>

const DEFAULT_VALUES: VarMap = {
  'Student Name': 'Alisha Vaz',
  'Teacher Name': 'Yaashvi Kedia',
  Instrument: 'Piano',
  Date: '14 Mar 2026',
  Time: '5:00 PM - 6:00 PM',
  Link: 'https://maestera.com/dashboard',
  'Join Link': 'https://maestera.com/dashboard',
  'Dashboard Link': 'https://teacher.maestera.com',
  Mode: 'online',
  Level: 'beginner',
  'Duration of lesson': '60 mins',
  'Fee per lesson': '2000',
  'Number of Lessons': '4',
  Number: '4',
  'Amount Paid': '8000',
  'Schedule Link': 'https://maestera.com/dashboard/my-courses',
  X: '1',
  Y: '0',
  Z: '3',
}

function valueForVariable(variableName: string): string {
  return DEFAULT_VALUES[variableName] || `sample_${variableName.toLowerCase().replace(/\s+/g, '_')}`
}

async function main() {
  const teacherPhone = process.env.WHATSAPP_TEACHER_TEST_PHONE || process.env.WHATSAPP_TEST_PHONE || '+919999999999'
  const studentPhone = process.env.WHATSAPP_STUDENT_TEST_PHONE || process.env.WHATSAPP_TEST_PHONE || '+919999999999'

  const templates = await prisma.notification_templates.findMany({
    where: {
      is_active: true,
      channels: {
        has: 'whatsapp',
      },
    },
    orderBy: [{ audience: 'asc' }, { trigger_key: 'asc' }],
  })

  if (templates.length === 0) {
    console.log('No active WhatsApp templates found in notification_templates')
    return
  }

  console.log(`Found ${templates.length} active WhatsApp templates`)
  console.log(`Using teacher phone: ${teacherPhone}`)
  console.log(`Using student phone: ${studentPhone}`)
  console.log('---')

  const sendTemplateWhatsApp = (ActivityNotificationService as any).sendTemplateWhatsApp as (
    recipientPhone: string,
    whatsappVerified: boolean,
    whatsappOptIn: boolean,
    triggerKey: string,
    variables: Record<string, string>
  ) => Promise<void>

  let passed = 0
  const failed: Array<{ trigger: string; error: string }> = []

  for (const tpl of templates) {
    const audience = String(tpl.audience || 'student').toLowerCase()
    const recipientPhone = audience === 'teacher' ? teacherPhone : studentPhone
    const variableKeys = Array.isArray(tpl.variables)
      ? (tpl.variables as unknown[]).filter((item): item is string => typeof item === 'string')
      : []

    const vars: Record<string, string> = {}
    for (const key of variableKeys) {
      vars[key] = valueForVariable(key)
    }

    try {
      await sendTemplateWhatsApp(recipientPhone, true, true, tpl.trigger_key, vars)
      passed += 1
      console.log(`PASS ${tpl.trigger_key} [${audience}] -> ${variableKeys.length} vars -> ${recipientPhone}`)
    } catch (error: any) {
      failed.push({
        trigger: tpl.trigger_key,
        error: error?.message || String(error),
      })
      console.error(`FAIL ${tpl.trigger_key}: ${error?.message || String(error)}`)
    }
  }

  console.log('---')
  console.log(`Summary: ${passed}/${templates.length} passed`)

  if (failed.length > 0) {
    console.log('Failed templates:')
    for (const item of failed) {
      console.log(`- ${item.trigger}: ${item.error}`)
    }
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('Fatal test error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
