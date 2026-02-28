import { Router } from "express";
import { bookingController } from "../controllers/booking.controller";
import { authenticateUser } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticateUser);

// Student routes
router.post("/request-demo", bookingController.requestDemo.bind(bookingController));
router.post("/schedule-session", bookingController.scheduleSession.bind(bookingController));
router.get("/student", bookingController.getStudentBookings.bind(bookingController));
router.patch("/:id/confirm-reschedule", bookingController.confirmReschedule.bind(bookingController));

// Teacher routes
router.get("/teacher", bookingController.getTeacherBookings.bind(bookingController));
router.get("/teacher/package-students", bookingController.getTeacherPackageStudents.bind(bookingController));
router.get("/teacher/pending-count", bookingController.getPendingCount.bind(bookingController));
router.get("/teacher/student/:studentId", bookingController.getStudentProfile.bind(bookingController));
router.post("/teacher/schedule-session", bookingController.scheduleSessionByTeacher.bind(bookingController));
router.patch("/:id/accept", bookingController.acceptBooking.bind(bookingController));
router.patch("/:id/reschedule", bookingController.rescheduleBooking.bind(bookingController));
router.patch("/:id/complete", bookingController.markBookingCompleted.bind(bookingController));

// Shared routes
router.get("/:id", bookingController.getBookingById.bind(bookingController));
router.patch("/:id/cancel", bookingController.cancelBooking.bind(bookingController));

export default router;
