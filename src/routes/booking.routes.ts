import { Router } from "express";
import { bookingController } from "../controllers/booking.controller";
import { authenticateUser } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Student routes
router.post("/request-demo", bookingController.requestDemo.bind(bookingController));
router.get("/student", bookingController.getStudentBookings.bind(bookingController));
router.patch("/:id/confirm-reschedule", bookingController.confirmReschedule.bind(bookingController));

// Teacher routes
router.get("/teacher", bookingController.getTeacherBookings.bind(bookingController));
router.get("/teacher/pending-count", bookingController.getPendingCount.bind(bookingController));
router.patch("/:id/accept", bookingController.acceptBooking.bind(bookingController));
router.patch("/:id/reschedule", bookingController.rescheduleBooking.bind(bookingController));

// Shared routes
router.get("/:id", bookingController.getBookingById.bind(bookingController));
router.patch("/:id/cancel", bookingController.cancelBooking.bind(bookingController));

export default router;
