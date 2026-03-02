import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AuthUser } from "../types";
import { AppError } from "../types";
import { RecipientRole, WhatsAppNotificationService } from "./whatsapp-notification.service";

type SupportedRole = "teacher" | "student";

interface RequestOtpResult {
  challengeId: string;
  expiresAt: Date;
  resendAfterSeconds: number;
  whatsappNumberMasked: string;
}

interface VerifyOtpResult {
  verified: boolean;
  whatsappNumber: string;
  whatsappVerifiedAt: Date;
}

interface StatusResult {
  role: SupportedRole;
  whatsappNumber: string | null;
  whatsappVerified: boolean;
  whatsappVerifiedAt: Date | null;
  whatsappOptIn: boolean;
}

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = Number(process.env.WHATSAPP_OTP_RESEND_COOLDOWN_SECONDS || 30);
const OTP_EXPIRY_MINUTES = Number(process.env.WHATSAPP_OTP_EXPIRY_MINUTES || 5);
const MAX_ATTEMPTS = Number(process.env.WHATSAPP_OTP_MAX_ATTEMPTS || 5);
const DAILY_REQUEST_LIMIT = Number(process.env.WHATSAPP_OTP_DAILY_LIMIT || 10);

export class WhatsAppVerificationService {
  private static isSchemaMissingError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    return error.code === "P2021" || error.code === "P2022";
  }

  private static schemaUnavailableError(): Error {
    return new AppError(
      503,
      "WhatsApp verification is temporarily unavailable. Please run database migrations.",
      "WHATSAPP_SCHEMA_NOT_READY"
    );
  }

  private static resolveRole(user: AuthUser): SupportedRole {
    if (user.role === "teacher") return "teacher";
    if (user.role === "student") return "student";
    throw new Error("WhatsApp verification is available only for students and teachers");
  }

  private static getOtpSecret(): string {
    const secret = process.env.WHATSAPP_OTP_SECRET;
    if (!secret) {
      throw new AppError(503, "WhatsApp OTP is not configured on the server", "WHATSAPP_OTP_NOT_CONFIGURED");
    }
    return secret;
  }

  private static maskPhone(phone: string): string {
    const clean = phone.replace(/\D/g, "");
    if (clean.length <= 4) return phone;
    return `${"*".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
  }

  private static generateOtp(): string {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH - 1;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  private static buildOtpHash(challengeId: string, otpCode: string): string {
    const secret = this.getOtpSecret();
    return crypto
      .createHash("sha256")
      .update(`${challengeId}.${otpCode}.${secret}`)
      .digest("hex");
  }

  private static safeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }

  private static async getRoleRecord(userId: string, role: SupportedRole) {
    try {
      if (role === "teacher") {
        return await prisma.teachers.findUnique({
          where: { id: userId },
          select: {
            id: true,
            whatsapp_number: true,
            whatsapp_verified_at: true,
            whatsapp_opt_in: true,
          },
        });
      }

      return await prisma.students.findUnique({
        where: { id: userId },
        select: {
          id: true,
          whatsapp_number: true,
          whatsapp_verified_at: true,
          whatsapp_opt_in: true,
        },
      });
    } catch (error) {
      if (!this.isSchemaMissingError(error)) throw error;

      const basic = role === "teacher"
        ? await prisma.teachers.findUnique({ where: { id: userId }, select: { id: true } })
        : await prisma.students.findUnique({ where: { id: userId }, select: { id: true } });

      if (!basic) return null;

      return {
        id: basic.id,
        whatsapp_number: null,
        whatsapp_verified_at: null,
        whatsapp_opt_in: true,
      };
    }
  }

  private static async updateRoleRecord(
    userId: string,
    role: SupportedRole,
    data: { whatsapp_number: string; whatsapp_verified_at: Date; whatsapp_opt_in: boolean }
  ) {
    try {
      if (role === "teacher") {
        await prisma.teachers.update({
          where: { id: userId },
          data,
        });
        return;
      }

      await prisma.students.update({
        where: { id: userId },
        data,
      });
    } catch (error) {
      if (this.isSchemaMissingError(error)) {
        throw this.schemaUnavailableError();
      }
      throw error;
    }
  }

  static async requestOtp(user: AuthUser, phone: string): Promise<RequestOtpResult> {
    try {
      const role = this.resolveRole(user);
      const normalizedPhone = WhatsAppNotificationService.normalizePhone(phone);

      if (!normalizedPhone) {
        throw new Error("Invalid WhatsApp number format");
      }

      const userRecord = await this.getRoleRecord(user.id, role);
      if (!userRecord) {
        throw new Error(`${role} profile not found`);
      }

      const now = new Date();
      const cooldownFrom = new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000);
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);

      const [recentChallenge, dailyCount] = await Promise.all([
        prisma.whatsapp_otp_challenges.findFirst({
          where: {
            user_id: user.id,
            created_at: { gte: cooldownFrom },
          },
          orderBy: { created_at: "desc" },
        }),
        prisma.whatsapp_otp_challenges.count({
          where: {
            user_id: user.id,
            created_at: { gte: dayStart },
          },
        }),
      ]);

      if (recentChallenge) {
        const elapsedSeconds = Math.floor((now.getTime() - recentChallenge.created_at.getTime()) / 1000);
        const remaining = Math.max(1, RESEND_COOLDOWN_SECONDS - elapsedSeconds);
        throw new Error(`Please wait ${remaining}s before requesting another OTP`);
      }

      if (dailyCount >= DAILY_REQUEST_LIMIT) {
        throw new Error("Daily OTP limit reached. Please try again tomorrow.");
      }

      const otpCode = this.generateOtp();
      const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

      const challenge = await prisma.whatsapp_otp_challenges.create({
        data: {
          user_id: user.id,
          role,
          whatsapp_number: normalizedPhone,
          otp_hash: "pending",
          expires_at: expiresAt,
          max_attempts: MAX_ATTEMPTS,
        },
      });

      const otpHash = this.buildOtpHash(challenge.id, otpCode);
      await prisma.whatsapp_otp_challenges.update({
        where: { id: challenge.id },
        data: { otp_hash: otpHash },
      });

      try {
        await WhatsAppNotificationService.sendOtpNotification({
          recipientPhone: normalizedPhone,
          otpCode,
          expiryMinutes: OTP_EXPIRY_MINUTES,
          role: role as RecipientRole,
        });
      } catch (error: any) {
        await prisma.whatsapp_otp_challenges.delete({ where: { id: challenge.id } });
        throw new Error(error?.message || "Failed to send WhatsApp OTP");
      }

      return {
        challengeId: challenge.id,
        expiresAt,
        resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
        whatsappNumberMasked: this.maskPhone(normalizedPhone),
      };
    } catch (error) {
      if (this.isSchemaMissingError(error)) {
        throw this.schemaUnavailableError();
      }
      throw error;
    }
  }

  static async verifyOtp(user: AuthUser, challengeId: string, otpCode: string): Promise<VerifyOtpResult> {
    try {
      const role = this.resolveRole(user);

      const challenge = await prisma.whatsapp_otp_challenges.findUnique({
        where: { id: challengeId },
      });

      if (!challenge || challenge.user_id !== user.id || challenge.role !== role) {
        throw new Error("Invalid OTP challenge");
      }

      if (challenge.consumed_at) {
        throw new Error("OTP already used");
      }

      if (challenge.expires_at < new Date()) {
        throw new Error("OTP expired. Please request a new one.");
      }

      if (challenge.attempts >= challenge.max_attempts) {
        throw new Error("OTP attempts exceeded. Please request a new one.");
      }

      const computedHash = this.buildOtpHash(challenge.id, otpCode.trim());
      const isValid = this.safeEqual(challenge.otp_hash, computedHash);

      if (!isValid) {
        await prisma.whatsapp_otp_challenges.update({
          where: { id: challenge.id },
          data: {
            attempts: { increment: 1 },
            updated_at: new Date(),
          },
        });
        throw new Error("Invalid OTP");
      }

      const verifiedAt = new Date();

      await Promise.all([
        prisma.whatsapp_otp_challenges.update({
          where: { id: challenge.id },
          data: {
            consumed_at: verifiedAt,
            updated_at: verifiedAt,
          },
        }),
        this.updateRoleRecord(user.id, role, {
          whatsapp_number: challenge.whatsapp_number,
          whatsapp_verified_at: verifiedAt,
          whatsapp_opt_in: true,
        }),
      ]);

      return {
        verified: true,
        whatsappNumber: challenge.whatsapp_number,
        whatsappVerifiedAt: verifiedAt,
      };
    } catch (error) {
      if (this.isSchemaMissingError(error)) {
        throw this.schemaUnavailableError();
      }
      throw error;
    }
  }

  static async getStatus(user: AuthUser): Promise<StatusResult> {
    const role = this.resolveRole(user);
    const record = await this.getRoleRecord(user.id, role);

    if (!record) {
      throw new Error(`${role} profile not found`);
    }

    return {
      role,
      whatsappNumber: record.whatsapp_number,
      whatsappVerified: Boolean(record.whatsapp_verified_at),
      whatsappVerifiedAt: record.whatsapp_verified_at,
      whatsappOptIn: record.whatsapp_opt_in ?? true,
    };
  }
}
