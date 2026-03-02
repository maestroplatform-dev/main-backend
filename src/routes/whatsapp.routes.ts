import { Router } from "express";
import { authenticateUser } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { WhatsAppController } from "../controllers/whatsapp.controller";

const router = Router();

router.use(authenticateUser);

router.get("/status", asyncHandler(WhatsAppController.getStatus));
router.post("/request-otp", asyncHandler(WhatsAppController.requestOtp));
router.post("/verify-otp", asyncHandler(WhatsAppController.verifyOtp));

export default router;
