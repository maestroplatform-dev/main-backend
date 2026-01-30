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
  package_id: string;
  teacher_id: string;
  selected_slots: Array<{
    day_of_week: number;
    start_time: string;
    duration_minutes?: number;
  }>;
  payment_option: 'FLEXIBLE' | 'UPFRONT';
  sessions_to_pay: number;
}

interface VerifyPaymentBody {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  purchased_package_id: string;
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

      const { package_id, teacher_id, selected_slots, payment_option, sessions_to_pay } = req.body;

      // Validate required fields
      if (!package_id || !teacher_id || !selected_slots || !payment_option || !sessions_to_pay) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      if (selected_slots.length === 0 || selected_slots.length > 3) {
        return res.status(400).json({ error: 'Please select 1-3 time slots' });
      }

      if (!['FLEXIBLE', 'UPFRONT'].includes(payment_option)) {
        return res.status(400).json({ error: 'Invalid payment option' });
      }

      const result = await paymentService.createOrder({
        student_id: userId,
        package_id,
        teacher_id,
        selected_slots,
        payment_option,
        sessions_to_pay
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

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, purchased_package_id } = req.body;

      // Validate required fields
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !purchased_package_id) {
        return res.status(400).json({ error: 'Missing required payment verification fields' });
      }

      const result = await paymentService.verifyPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        purchased_package_id
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

      return res.status(200).json({
        success: true,
        data: packages
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

      const packageDetails = await paymentService.getPackageDetails(packageId);

      if (!packageDetails) {
        return res.status(404).json({ error: 'Package not found' });
      }

      // Verify the package belongs to the user
      if (packageDetails.student_id !== userId && packageDetails.teacher_id !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      return res.status(200).json({
        success: true,
        data: packageDetails
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
