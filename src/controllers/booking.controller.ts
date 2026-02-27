import { Response } from "express";
import { bookingService } from "../services/booking.service";
import { booking_status } from "@prisma/client";
import { AuthRequest } from "../types";

export class BookingController {
  /**
   * POST /api/bookings/request-demo
   * Student requests a demo class with a teacher
   */
  async requestDemo(req: AuthRequest, res: Response) {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { teacherId, scheduledAt, notes, instrument } = req.body;

      if (!teacherId || !scheduledAt) {
        res.status(400).json({ error: "teacherId and scheduledAt are required" });
        return;
      }

      const booking = await bookingService.requestDemo(
        studentId,
        teacherId,
        new Date(scheduledAt),
        notes,
        instrument
      );

      res.status(201).json({
        success: true,
        message: "Demo request sent successfully",
        data: booking,
      });
    } catch (error: any) {
      console.error("Error requesting demo:", error);
      res.status(400).json({ error: error.message || "Failed to request demo" });
    }
  }

  /**
   * POST /api/bookings/schedule-session
   * Student schedules a session from a purchased package
   */
  async scheduleSession(req: AuthRequest, res: Response) {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { purchasedPackageId, scheduledAt, durationMinutes } = req.body;

      if (!purchasedPackageId || !scheduledAt) {
        res.status(400).json({ error: "purchasedPackageId and scheduledAt are required" });
        return;
      }

      const booking = await bookingService.schedulePackageSession(
        studentId,
        purchasedPackageId,
        new Date(scheduledAt),
        durationMinutes || 60
      );

      res.status(201).json({
        success: true,
        message: "Session scheduled successfully",
        data: booking,
      });
    } catch (error: any) {
      console.error("Error scheduling session:", error);
      res.status(400).json({ error: error.message || "Failed to schedule session" });
    }
  }

  /**
   * GET /api/bookings/teacher
   * Get all bookings for the authenticated teacher
   */
  async getTeacherBookings(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.id;
      if (!teacherId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const statusParam = req.query.status as string | undefined;
      let status: booking_status[] | undefined;
      
      if (statusParam) {
        status = statusParam.split(",") as booking_status[];
      }

      const bookings = await bookingService.getTeacherBookings(teacherId, status);

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error: any) {
      console.error("Error fetching teacher bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  }

  /**
   * GET /api/bookings/student
   * Get all bookings for the authenticated student
   */
  async getStudentBookings(req: AuthRequest, res: Response) {
    try {
      const studentId = req.user?.id;
      if (!studentId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const statusParam = req.query.status as string | undefined;
      let status: booking_status[] | undefined;
      
      if (statusParam) {
        status = statusParam.split(",") as booking_status[];
      }

      const bookings = await bookingService.getStudentBookings(studentId, status);

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error: any) {
      console.error("Error fetching student bookings:", error);
      res.status(500).json({ error: "Failed to fetch bookings" });
    }
  }

  /**
   * GET /api/bookings/:id
   * Get a single booking by ID
   */
  async getBookingById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const booking = await bookingService.getBookingById(id);

      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      // Check if user has access to this booking
      if (booking.student_id !== userId && booking.teacher_id !== userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      res.json({
        success: true,
        data: booking,
      });
    } catch (error: any) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: "Failed to fetch booking" });
    }
  }

  /**
   * PATCH /api/bookings/:id/accept
   * Teacher accepts a demo request
   */
  async acceptBooking(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const teacherId = req.user?.id;

      if (!teacherId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const booking = await bookingService.acceptBooking(id, teacherId);

      res.json({
        success: true,
        message: "Booking accepted successfully",
        data: booking,
      });
    } catch (error: any) {
      console.error("Error accepting booking:", error);
      res.status(400).json({ error: error.message || "Failed to accept booking" });
    }
  }

  /**
   * PATCH /api/bookings/:id/reschedule
   * Teacher or student proposes a new time
   */
  async rescheduleBooking(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const { newScheduledAt } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!newScheduledAt) {
        res.status(400).json({ error: "newScheduledAt is required" });
        return;
      }

      const booking = await bookingService.rescheduleBooking(
        id,
        userId,
        new Date(newScheduledAt)
      );

      res.json({
        success: true,
        message: "Reschedule proposal sent successfully",
        data: booking,
      });
    } catch (error: any) {
      console.error("Error rescheduling booking:", error);
      res.status(400).json({ error: error.message || "Failed to reschedule booking" });
    }
  }

  /**
   * PATCH /api/bookings/:id/confirm-reschedule
   * Counterparty confirms the rescheduled time
   */
  async confirmReschedule(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const booking = await bookingService.confirmReschedule(id, userId);

      res.json({
        success: true,
        message: "Reschedule confirmed successfully",
        data: booking,
      });
    } catch (error: any) {
      console.error("Error confirming reschedule:", error);
      res.status(400).json({ error: error.message || "Failed to confirm reschedule" });
    }
  }

  /**
   * PATCH /api/bookings/:id/complete
   * Teacher marks a class as completed
   */
  async markBookingCompleted(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const teacherId = req.user?.id;

      if (!teacherId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const booking = await bookingService.markBookingCompleted(id, teacherId);

      res.json({
        success: true,
        message: "Attendance marked successfully",
        data: booking,
      });
    } catch (error: any) {
      console.error("Error marking booking completed:", error);
      res.status(400).json({ error: error.message || "Failed to mark booking completed" });
    }
  }

  /**
   * PATCH /api/bookings/:id/cancel
   * Cancel a booking (by either party)
   */
  async cancelBooking(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const booking = await bookingService.cancelBooking(id, userId);

      res.json({
        success: true,
        message: "Booking cancelled successfully",
        data: booking,
      });
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      res.status(400).json({ error: error.message || "Failed to cancel booking" });
    }
  }

  /**
   * GET /api/bookings/teacher/pending-count
   * Get count of pending demo requests for the teacher
   */
  async getPendingCount(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.id;
      if (!teacherId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const count = await bookingService.getPendingRequestsCount(teacherId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error("Error fetching pending count:", error);
      res.status(500).json({ error: "Failed to fetch pending count" });
    }
  }

  /**
   * GET /api/teachers/:teacherId/public-availability
   * Get public availability for a teacher (for students to book)
   */
  async getPublicAvailability(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.params.teacherId as string;
      const { startDate, endDate } = req.query;

      // Default to next 40 days if not specified
      const start = startDate ? new Date(startDate as string) : new Date();
      const end = endDate
        ? new Date(endDate as string)
        : new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);

      const availability = await bookingService.getPublicAvailability(
        teacherId,
        start,
        end
      );

      res.json({
        success: true,
        data: availability,
      });
    } catch (error: any) {
      console.error("Error fetching public availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  }

  /**
   * GET /api/bookings/teacher/student/:studentId
   * Get student profile with class history for a teacher
   */
  async getStudentProfile(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.id;
      const studentId = req.params.studentId as string;

      if (!teacherId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const profile = await bookingService.getStudentProfileForTeacher(teacherId, studentId);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      console.error("Error fetching student profile:", error);
      res.status(400).json({ error: error.message || "Failed to fetch student profile" });
    }
  }
}

export const bookingController = new BookingController();
