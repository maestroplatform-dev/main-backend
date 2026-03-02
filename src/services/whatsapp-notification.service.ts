type ActivityEvent =
  | "SESSION_SCHEDULED_BY_TEACHER"
  | "SESSION_SCHEDULED_BY_STUDENT"
  | "SESSION_RESCHEDULED_BY_TEACHER"
  | "SESSION_RESCHEDULED_BY_STUDENT"
  | "SESSION_CANCELLED_BY_TEACHER"
  | "SESSION_CANCELLED_BY_STUDENT"
  | "PACKAGE_PURCHASED";

type RecipientRole = "teacher" | "student";

interface WhatsAppNotificationInput {
  event: ActivityEvent;
  recipientRole: RecipientRole;
  recipientPhone: string;
  variables: Record<string, string | number | boolean | null | undefined>;
}

const TEMPLATE_MAP: Record<ActivityEvent, string> = {
  SESSION_SCHEDULED_BY_TEACHER: "session_scheduled_by_teacher",
  SESSION_SCHEDULED_BY_STUDENT: "session_scheduled_by_student",
  SESSION_RESCHEDULED_BY_TEACHER: "session_rescheduled_by_teacher",
  SESSION_RESCHEDULED_BY_STUDENT: "session_rescheduled_by_student",
  SESSION_CANCELLED_BY_TEACHER: "session_cancelled_by_teacher",
  SESSION_CANCELLED_BY_STUDENT: "session_cancelled_by_student",
  PACKAGE_PURCHASED: "package_purchased",
};

export class WhatsAppNotificationService {
  private static isEnabled() {
    return process.env.WHATSAPP_NOTIFICATIONS_ENABLED === "true";
  }

  private static getProvider() {
    return (process.env.WHATSAPP_PROVIDER || "11za").toLowerCase();
  }

  private static getApiUrl() {
    return process.env.WHATSAPP_11ZA_API_URL || "";
  }

  private static getApiKey() {
    return process.env.WHATSAPP_11ZA_API_KEY || "";
  }

  private static getOriginWebsite() {
    const originWebsite = process.env.WHATSAPP_11ZA_ORIGIN_WEBSITE || "";
    if (!originWebsite) {
      throw new Error("WHATSAPP_11ZA_ORIGIN_WEBSITE is not configured");
    }
    return originWebsite;
  }

  private static getOriginWebsiteCandidates(): string[] {
    const raw = this.getOriginWebsite().trim();
    const candidates = new Set<string>();

    if (raw) {
      candidates.add(raw);
      candidates.add(raw.replace(/\/+$/, ""));
    }

    try {
      const parsed = new URL(raw);
      if (parsed.hostname) {
        candidates.add(parsed.hostname);
        candidates.add(`https://${parsed.hostname}`);
        candidates.add(`https://${parsed.hostname}/`);
      }
    } catch {
      const host = raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (host) {
        candidates.add(host);
        candidates.add(`https://${host}`);
        candidates.add(`https://${host}/`);
      }
    }

    return Array.from(candidates).filter(Boolean);
  }

  private static getLanguage() {
    return process.env.WHATSAPP_11ZA_LANGUAGE || "en";
  }

  private static to11zaSendTo(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  private static async send11zaTemplate(payload: Record<string, any>, context: string): Promise<void> {
    const apiUrl = this.getApiUrl();

    const fetchFn = (globalThis as any).fetch as
      | ((input: string, init?: Record<string, any>) => Promise<any>)
      | undefined;

    if (!fetchFn) {
      throw new Error("global fetch is unavailable in current runtime");
    }

    const response = await fetchFn(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `[whatsapp][${context}] 11za API failed: ${response.status} ${response.statusText} ${responseText}`
      );
    }

    if (responseText) {
      console.log(`[whatsapp][${context}] 11za response: ${responseText}`);
    }
  }

  private static async sendWithOriginFallback(
    payloadWithoutOrigin: Record<string, any>,
    context: string
  ): Promise<void> {
    const originCandidates = this.getOriginWebsiteCandidates();
    let lastError: unknown = null;

    for (const originWebsite of originCandidates) {
      try {
        await this.send11zaTemplate(
          {
            ...payloadWithoutOrigin,
            originWebsite,
          },
          context
        );
        return;
      } catch (error: any) {
        lastError = error;
        const message = String(error?.message || "");
        if (message.includes("Invalid originWebsites")) {
          continue;
        }
        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`[whatsapp][${context}] Failed to send template with available originWebsite values`);
  }

  static normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("+")) return trimmed;

    const onlyDigits = trimmed.replace(/\D/g, "");
    if (!onlyDigits) return "";

    if (onlyDigits.length === 10) {
      return `+91${onlyDigits}`;
    }

    return `+${onlyDigits}`;
  }

  static async sendActivityNotification(input: WhatsAppNotificationInput): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    if (this.getProvider() !== "11za") {
      console.warn("[whatsapp] Unsupported provider configured:", this.getProvider());
      return;
    }

    const apiUrl = this.getApiUrl();
    const apiKey = this.getApiKey();

    if (!apiUrl || !apiKey) {
      console.warn("[whatsapp] WHATSAPP_11ZA_API_URL or WHATSAPP_11ZA_API_KEY is missing");
      return;
    }

    const normalizedPhone = this.normalizePhone(input.recipientPhone);
    if (!normalizedPhone) {
      console.warn("[whatsapp] Recipient phone missing/invalid for event:", input.event);
      return;
    }

    const templateName = TEMPLATE_MAP[input.event];
    const variableValues = Object.values(input.variables)
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value));

    const payload = {
      authToken: apiKey,
      sendto: this.to11zaSendTo(normalizedPhone),
      templateName,
      language: this.getLanguage(),
      name: input.recipientRole === "teacher" ? "Teacher" : "Student",
      data: variableValues,
      tags: `event:${input.event},role:${input.recipientRole}`,
    };

    if (process.env.WHATSAPP_DRY_RUN === "true") {
      console.log("[whatsapp][dry-run]", JSON.stringify(payload));
      return;
    }

    await this.sendWithOriginFallback(payload, input.event);
  }

  static async sendOtpNotification(input: {
    recipientPhone: string;
    otpCode: string;
    expiryMinutes: number;
    role: RecipientRole;
  }): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error("WhatsApp notifications are disabled on server");
    }

    if (this.getProvider() !== "11za") {
      console.warn("[whatsapp] Unsupported provider configured:", this.getProvider());
      return;
    }

    const apiUrl = this.getApiUrl();
    const apiKey = this.getApiKey();
    if (!apiUrl || !apiKey) {
      console.warn("[whatsapp] WHATSAPP_11ZA_API_URL or WHATSAPP_11ZA_API_KEY is missing");
      return;
    }

    const normalizedPhone = this.normalizePhone(input.recipientPhone);
    if (!normalizedPhone) {
      throw new Error("Invalid WhatsApp phone number");
    }

    const payload = {
      authToken: apiKey,
      sendto: this.to11zaSendTo(normalizedPhone),
      templateName: process.env.WHATSAPP_11ZA_OTP_TEMPLATE || "whatsapp_otp_verification",
      language: this.getLanguage(),
      name: input.role === "teacher" ? "Teacher" : "Student",
      data: [input.otpCode, String(input.expiryMinutes)],
      tags: `event:WHATSAPP_OTP,role:${input.role}`,
    };

    if (process.env.WHATSAPP_DRY_RUN === "true") {
      console.log("[whatsapp][dry-run][otp]", JSON.stringify(payload));
      return;
    }

    await this.sendWithOriginFallback(payload, "WHATSAPP_OTP");
  }
}

export type { ActivityEvent, RecipientRole };
