import { Response } from "express";
import { AuthRequest } from "../types";
import { WhatsAppVerificationService } from "../services/whatsapp-verification.service";

export class WhatsAppController {
  static async requestOtp(req: AuthRequest, res: Response) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const phone = (req.body?.phone || "").toString().trim();
    if (!phone) {
      return res.status(400).json({ error: "phone is required" });
    }

    const result = await WhatsAppVerificationService.requestOtp(user, phone);

    return res.json({
      success: true,
      message: "OTP sent successfully",
      data: result,
    });
  }

  static async verifyOtp(req: AuthRequest, res: Response) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const challengeId = (req.body?.challengeId || "").toString().trim();
    const otp = (req.body?.otp || "").toString().trim();

    if (!challengeId || !otp) {
      return res.status(400).json({ error: "challengeId and otp are required" });
    }

    const result = await WhatsAppVerificationService.verifyOtp(user, challengeId, otp);

    return res.json({
      success: true,
      message: "WhatsApp number verified successfully",
      data: result,
    });
  }

  static async getStatus(req: AuthRequest, res: Response) {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await WhatsAppVerificationService.getStatus(user);

    return res.json({
      success: true,
      data: result,
    });
  }
}
