import { Response } from 'express'
import { z } from 'zod'
import { AuthRequest } from '../types'
import { NotificationTemplateService } from '../services/notification-template.service'

const templateSchema = z.object({
  trigger_key: z.string().min(3),
  name: z.string().min(3),
  audience: z.enum(['student', 'teacher', 'both']),
  channels: z.array(z.enum(['email', 'whatsapp'])).min(1),
  email_subject: z.string().optional().nullable(),
  email_body: z.string().optional().nullable(),
  whatsapp_body: z.string().optional().nullable(),
  variables: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
})

const activeSchema = z.object({
  is_active: z.boolean(),
})

const seedSchema = z.object({
  overwrite: z.boolean().optional(),
})

export class NotificationTemplateController {
  static async list(_req: AuthRequest, res: Response): Promise<void> {
    const templates = await NotificationTemplateService.listTemplates()
    res.json({ success: true, data: { templates } })
  }

  static async get(req: AuthRequest, res: Response): Promise<void> {
    const triggerKey = req.params.triggerKey as string
    const template = await NotificationTemplateService.getTemplate(triggerKey)

    res.json({ success: true, data: { template } })
  }

  static async upsert(req: AuthRequest, res: Response): Promise<void> {
    const triggerKey = req.params.triggerKey as string
    const payload = templateSchema.parse({ ...req.body, trigger_key: triggerKey })

    const existing = await NotificationTemplateService.getTemplate(triggerKey)
    const sanitizedPayload = {
      ...payload,
      // WhatsApp content is managed from 11za templates, not admin panel
      whatsapp_body: existing?.whatsapp_body ?? null,
    }

    const template = await NotificationTemplateService.upsertTemplate(sanitizedPayload)
    res.json({ success: true, data: { template } })
  }

  static async setActive(req: AuthRequest, res: Response): Promise<void> {
    const triggerKey = req.params.triggerKey as string
    const { is_active } = activeSchema.parse(req.body)

    const template = await NotificationTemplateService.setActive(triggerKey, is_active)
    res.json({ success: true, data: { template } })
  }

  static async seedDefaults(req: AuthRequest, res: Response): Promise<void> {
    const { overwrite } = seedSchema.parse(req.body || {})
    const result = await NotificationTemplateService.seedDefaults(Boolean(overwrite))

    res.json({
      success: true,
      data: result,
      message: `Notification templates seeded (created: ${result.created}, updated: ${result.updated})`,
    })
  }
}
