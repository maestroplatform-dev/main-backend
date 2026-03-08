-- Create admin-managed notification templates table
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key text NOT NULL UNIQUE,
  name text NOT NULL,
  audience text NOT NULL,
  channels text[] NOT NULL DEFAULT '{}',
  email_subject text,
  email_body text,
  whatsapp_body text,
  variables text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_trigger
  ON public.notification_templates(trigger_key);

CREATE INDEX IF NOT EXISTS idx_notification_templates_active
  ON public.notification_templates(is_active);