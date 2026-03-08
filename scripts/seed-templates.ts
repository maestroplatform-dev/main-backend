import dotenv from 'dotenv'
dotenv.config()

import { NotificationTemplateService } from '../src/services/notification-template.service'

async function main() {
  const result = await NotificationTemplateService.seedDefaults()
  console.log(`✅ Seeded templates — created: ${result.created}, updated: ${result.updated}, total: ${result.total}`)
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
