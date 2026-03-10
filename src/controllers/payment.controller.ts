import { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';

// Request body types
interface ValidateScheduleBody {
  teacher_id: string;
  selected_slots: Array<{
    day_of_week: number;
    start_time: string;
    duration_minutes?: number;
  }>;
}

interface CreateOrderBody {
  package_id?: string;
  teacher_id: string;
  scheduled_sessions: Array<{
    date: string;
    start_time: string;
    end_time: string;
  }>;
  instrument: string;
  level: string;
  mode: string;
  payment_option: 'FLEXIBLE' | 'UPFRONT';
  sessions_to_pay?: number;
  sessions_count?: number;
}

interface VerifyPaymentBody {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  purchase_id: string;
}

interface CheckoutDismissedBody {
  razorpay_order_id: string;
  purchase_id: string;
}

interface CreateNextPaymentBody {
  purchased_package_id: string;
}

interface CancelPackageBody {
  purchased_package_id: string;
}

export class PaymentController {
  /**
   * POST /api/v1/payments/validate-schedule
   * Validates that selected slots are available for the teacher
   */
  async validateSchedule(req: Request<{}, {}, ValidateScheduleBody>, res: Response) {
    try {
      const { teacher_id, selected_slots } = req.body;

      // Validate required fields
      if (!teacher_id || !selected_slots) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (selected_slots.length === 0 || selected_slots.length > 3) {
        return res.status(400).json({ error: 'Please select 1-3 time slots' });
      }

      const result = await paymentService.validateSchedule({
        teacher_id,
        selected_slots
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('❌ Error validating schedule:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to validate schedule'
      });
    }
  }

  /**
   * POST /api/v1/payments/create-order
   * Creates a Razorpay order for package purchase
   */
  async createOrder(req: Request<{}, {}, CreateOrderBody>, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { package_id, teacher_id, scheduled_sessions, instrument, level, mode, payment_option, sessions_to_pay, sessions_count } = req.body;

      // Validate required fields
      if (!teacher_id || !instrument || !level || !mode || !payment_option) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Must have either package_id or sessions_count
      if (!package_id && (!sessions_count || sessions_count <= 0)) {
        return res.status(400).json({ error: 'Please specify the number of sessions' });
      }

      if (!['FLEXIBLE', 'UPFRONT'].includes(payment_option)) {
        return res.status(400).json({ error: 'Invalid payment option' });
      }

      const result = await paymentService.createOrder({
        student_id: userId,
        package_id,
        teacher_id,
        scheduled_sessions: scheduled_sessions || [],
        instrument,
        level,
        mode,
        payment_option,
        sessions_to_pay,
        sessions_count,
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to create order'
      });
    }
  }

  /**
   * POST /api/v1/payments/verify-payment
   * Verifies Razorpay payment and activates package
   */
  async verifyPayment(req: Request<{}, {}, VerifyPaymentBody>, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, purchase_id } = req.body;

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !purchase_id) {
        return res.status(400).json({ error: 'Missing required payment verification fields' });
      }

      const result = await paymentService.verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        purchased_package_id: purchase_id
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('❌ Error verifying payment:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Payment verification failed'
      });
    }
  }

  /**
   * POST /api/v1/payments/checkout-dismissed
   * Marks abandoned Razorpay checkout as failed so user can retry immediately
   */
  async checkoutDismissed(req: Request<{}, {}, CheckoutDismissedBody>, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { razorpay_order_id, purchase_id } = req.body;

      if (!razorpay_order_id || !purchase_id) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await paymentService.markCheckoutAbandoned({
        razorpay_order_id,
        purchased_package_id: purchase_id,
      }, userId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('❌ Error marking checkout dismissed:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to update checkout status',
      });
    }
  }

  /**
   * POST /api/v1/payments/create-next-payment
   * Creates order for next tranche of flexible payments
   */
  async createNextTranchePayment(req: Request<{}, {}, CreateNextPaymentBody>, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { purchased_package_id } = req.body;

      if (!purchased_package_id) {
        return res.status(400).json({ error: 'Missing purchased_package_id' });
      }

      const result = await paymentService.createNextTranchePayment(purchased_package_id);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('❌ Error creating next tranche payment:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to create payment'
      });
    }
  }

  /**
   * GET /api/v1/payments/packages
   * Gets all packages for the authenticated student
   */
  async getStudentPackages(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const packages = await paymentService.getStudentPackages(userId);

      // Transform raw database records into frontend-expected format
      const transformedPackages = packages.map(pkg => ({
        id: pkg.id,
        teacher_id: pkg.teacher_id,
        package_id: pkg.package_id,
        instrument: pkg.instrument,
        level: pkg.level,
        mode: pkg.mode,
        payment_option: pkg.payment_option,
        status: pkg.status,
        total_sessions: pkg.classes_total,
        sessions_booked: pkg.bookings?.length || 0,
        sessions_remaining: pkg.classes_remaining,
        total_amount: Number(pkg.total_package_price),
        amount_paid: Number(pkg.amount_paid),
        amount_remaining: Number(pkg.amount_remaining),
        created_at: pkg.purchased_at?.toISOString() || new Date().toISOString(),
        teacher: pkg.teachers,
        package: {
          id: pkg.class_packages?.id,
          name: pkg.class_packages?.name || `${pkg.classes_total} Sessions`,
          classes_count: pkg.class_packages?.classes_count || pkg.classes_total,
          validity_days: pkg.class_packages?.validity_days || 0
        },
        scheduled_sessions: (pkg.scheduled_sessions || []).map((ss, idx) => ({
          id: ss.id,
          session_number: idx + 1,
          date: '',
          start_time: ss.start_time,
          end_time: '',
          booking_id: null
        })),
        bookings: (pkg.bookings || []).map(b => ({
          id: b.id,
          starts_at: b.scheduled_at?.toISOString() || null,
          ends_at: b.scheduled_at
            ? new Date(b.scheduled_at.getTime() + (b.duration_minutes || 60) * 60000).toISOString()
            : null,
          date: b.scheduled_at?.toISOString().split('T')[0] || '',
          start_time: b.scheduled_at?.toISOString().split('T')[1]?.substring(0, 5) || '',
          end_time: '',
          status: b.status,
          meeting_link: b.meeting_link,
          rescheduled_at: b.rescheduled_at?.toISOString() || null,
          rescheduled_by: b.rescheduled_by || null,
          is_demo: b.is_demo,
          duration_minutes: b.duration_minutes,
          notes: b.notes,
        })),
        payments: (pkg.purchase_payments || []).map((payment, idx) => ({
          id: payment.id,
          tranche_number: idx + 1,
          amount: Number(payment.amount),
          sessions_covered: payment.sessions_covered,
          status: payment.status,
          razorpay_payment_id: payment.razorpay_payment_id,
          completed_at: payment.completed_at?.toISOString() || null,
        }))
      }));

      return res.status(200).json({
        success: true,
        data: transformedPackages
      });
    } catch (error: any) {
      console.error('❌ Error fetching packages:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch packages'
      });
    }
  }

  /**
   * GET /api/v1/payments/packages/:packageId
   * Gets details of a specific package
   */
  async getPackageDetails(req: Request<{ packageId: string }>, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { packageId } = req.params;

      const pkg = await paymentService.getPackageDetails(packageId);

      if (!pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      // Verify the package belongs to the user
      if (pkg.student_id !== userId && pkg.teacher_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Transform to frontend format
      const transformedPackage = {
        id: pkg.id,
        teacher_id: pkg.teacher_id,
        package_id: pkg.package_id,
        instrument: pkg.instrument,
        level: pkg.level,
        mode: pkg.mode,
        payment_option: pkg.payment_option,
        status: pkg.status,
        total_sessions: pkg.classes_total,
        sessions_booked: pkg.bookings?.length || 0,
        sessions_remaining: pkg.classes_remaining,
        total_amount: Number(pkg.total_package_price),
        amount_paid: Number(pkg.amount_paid),
        amount_remaining: Number(pkg.amount_remaining),
        created_at: pkg.purchased_at?.toISOString() || new Date().toISOString(),
        teacher: pkg.teachers,
        package: {
          id: pkg.class_packages?.id,
          name: pkg.class_packages?.name || `${pkg.classes_total} Sessions`,
          classes_count: pkg.class_packages?.classes_count || pkg.classes_total,
          validity_days: pkg.class_packages?.validity_days || 0
        },
        scheduled_sessions: (pkg.scheduled_sessions || []).map((ss, idx) => ({
          id: ss.id,
          session_number: idx + 1,
          date: '',
          start_time: ss.start_time,
          end_time: '',
          booking_id: null
        })),
        bookings: (pkg.bookings || []).map(b => ({
          id: b.id,
          starts_at: b.scheduled_at?.toISOString() || null,
          ends_at: b.scheduled_at
            ? new Date(b.scheduled_at.getTime() + (b.duration_minutes || 60) * 60000).toISOString()
            : null,
          date: b.scheduled_at?.toISOString().split('T')[0] || '',
          start_time: b.scheduled_at?.toISOString().split('T')[1]?.substring(0, 5) || '',
          end_time: '',
          status: b.status,
          meeting_link: b.meeting_link,
          rescheduled_at: b.rescheduled_at?.toISOString() || null,
          rescheduled_by: b.rescheduled_by || null,
          is_demo: b.is_demo,
          duration_minutes: b.duration_minutes,
          notes: b.notes,
        })),
        payments: (pkg.purchase_payments || []).map((payment, idx) => ({
          id: payment.id,
          tranche_number: idx + 1,
          amount: Number(payment.amount),
          sessions_covered: payment.sessions_covered,
          status: payment.status,
          razorpay_payment_id: payment.razorpay_payment_id,
          completed_at: payment.completed_at?.toISOString() || null,
        }))
      };

      return res.status(200).json({
        success: true,
        data: transformedPackage
      });
    } catch (error: any) {
      console.error('❌ Error fetching package details:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch package details'
      });
    }
  }

  /**
   * POST /api/v1/payments/packages/:packageId/cancel
   * Cancels a package
   */
  async cancelPackage(req: Request<{ packageId: string }>, res: Response) {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { packageId } = req.params;

      const result = await paymentService.cancelPackage(packageId, userId);

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('❌ Error cancelling package:', error);
      return res.status(400).json({
        success: false,
        error: error.message || 'Failed to cancel package'
      });
    }
  }

  /**
   * GET /api/v1/payments/config
   * Returns Razorpay key ID for frontend
   */
  async getConfig(req: Request, res: Response) {
    try {
      return res.status(200).json({
        success: true,
        data: {
          razorpay_key_id: process.env.RAZORPAY_KEY_ID || ''
        }
      });
    } catch (error: any) {
      console.error('❌ Error fetching config:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch config'
      });
    }
  }
}

export const paymentController = new PaymentController();
