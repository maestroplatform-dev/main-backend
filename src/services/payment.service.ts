import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { getRazorpayInstance } from '../config/razorpay';
import prisma from '../config/database';
import { payment_status, purchase_status, payment_option_type } from '@prisma/client';
import { computeTotalPrice, computePerClassPrice, buildPricingConfig } from '../utils/pricing';
import { ActivityNotificationService } from './activity-notification.service';

// Types
interface SelectedSlot {
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string; // "14:00" format
  duration_minutes?: number;
}

interface ValidateScheduleRequest {
  teacher_id: string;
  selected_slots: SelectedSlot[];
}

interface ValidateScheduleResponse {
  valid: boolean;
  conflicts: string[];
  first_available_dates: Array<{ day: string; time: string; date: string }>;
}

interface CreateOrderRequest {
  student_id: string;
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
  sessions_count?: number; // total sessions when purchasing without a package
}

interface CreateOrderResponse {
  purchase_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
  student_name: string;
  student_email: string;
  student_phone?: string;
}

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  purchased_package_id: string;
}

interface MarkCheckoutAbandonedRequest {
  razorpay_order_id: string;
  purchased_package_id: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  purchase: {
    id: string;
    status: string;
    sessions_booked: number;
  };
  bookings: Array<{
    id: string;
    date: string;
    start_time: string;
    end_time: string;
  }>;
}

export class PaymentService {
  private async markPendingPackageFailed(purchasedPackageId: string, reason: string) {
    const successfulPayments = await prisma.purchase_payments.count({
      where: {
        purchased_package_id: purchasedPackageId,
        status: 'SUCCESS',
      },
    });

    if (successfulPayments > 0) {
      return;
    }

    await prisma.purchased_packages.updateMany({
      where: {
        id: purchasedPackageId,
        status: 'PENDING',
      },
      data: {
        status: 'FAILED',
      },
    });

    await prisma.bookings.updateMany({
      where: {
        purchased_package_id: purchasedPackageId,
        status: 'SCHEDULED',
      },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  /**
   * Validates that a student doesn't already have an active package with the same teacher
   */
  async validateNoExistingPackage(studentId: string, teacherId: string): Promise<boolean> {
    const now = new Date();

    // Mark elapsed packages as EXPIRED so they don't block new purchases
    await prisma.purchased_packages.updateMany({
      where: {
        student_id: studentId,
        teacher_id: teacherId,
        status: {
          in: ['ACTIVE', 'PAUSED']
        },
        expires_at: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // Mark fully consumed active packages as COMPLETED so they don't block repurchase
    await prisma.purchased_packages.updateMany({
      where: {
        student_id: studentId,
        teacher_id: teacherId,
        status: 'ACTIVE',
        classes_remaining: {
          lte: 0,
        },
      },
      data: {
        status: 'COMPLETED',
      },
    });

    const existingPackage = await prisma.purchased_packages.findFirst({
      where: {
        student_id: studentId,
        teacher_id: teacherId,
        status: {
          notIn: ['CANCELLED', 'FAILED', 'EXPIRED', 'COMPLETED']
        },
      },
      select: {
        id: true,
      },
    });

    return !existingPackage;
  }

  /**
   * Validates that selected schedule slots are available for the teacher
   */
  async validateSchedule(data: ValidateScheduleRequest): Promise<ValidateScheduleResponse> {
    const { teacher_id, selected_slots } = data;

    const conflicts: string[] = [];
    const firstAvailableDates: Array<{ day: string; time: string; date: string }> = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Fetch teacher's availability
    const teacherAvailability = await prisma.teacher_availability.findMany({
      where: {
        teacher_id,
        is_unavailable: false
      }
    });

    // Check each selected slot against teacher availability
    for (const slot of selected_slots) {
      // Find matching availability for this day
      const availableSlot = teacherAvailability.find(
        (avail) => avail.day_of_week === slot.day_of_week &&
                   avail.start_time <= slot.start_time &&
                   avail.end_time >= slot.start_time
      );

      if (!availableSlot) {
        conflicts.push(
          `${dayNames[slot.day_of_week]} at ${slot.start_time} - Teacher not available`
        );
      } else {
        // Calculate first available date for this slot
        const firstDate = this.getNextDateForDayOfWeek(new Date(), slot.day_of_week);
        firstAvailableDates.push({
          day: dayNames[slot.day_of_week],
          time: slot.start_time,
          date: firstDate.toISOString().split('T')[0]
        });
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      first_available_dates: firstAvailableDates
    };
  }

  /**
   * Creates a Razorpay order and initializes the purchased package
   */
  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    const { student_id, package_id, teacher_id, scheduled_sessions, instrument, level, mode, payment_option } = data;

    // Determine total sessions: from sessions_count param, or from package, or from scheduled_sessions
    const requestedSessions = data.sessions_count && data.sessions_count > 0
      ? data.sessions_count
      : undefined;

    const sessions_to_pay = data.sessions_to_pay && data.sessions_to_pay > 0
      ? data.sessions_to_pay
      : (scheduled_sessions.length > 0 ? scheduled_sessions.length : requestedSessions || 0);

    // Auto-expire stale PENDING packages (abandoned checkouts older than 3 min)
    await prisma.purchased_packages.updateMany({
      where: {
        student_id,
        teacher_id,
        status: 'PENDING',
        purchased_at: {
          lt: new Date(Date.now() - 3 * 60 * 1000),
        },
      },
      data: { status: 'EXPIRED' },
    });

    // Validate no existing package
    const canPurchase = await this.validateNoExistingPackage(student_id, teacher_id);
    if (!canPurchase) {
      throw new Error('You already have an active package with this teacher');
    }

    // Determine classes count and validity
    let classesCount: number;
    let validityDays: number;

    if (package_id) {
      // Legacy flow: fetch from class_packages
      const classPackage = await prisma.class_packages.findUnique({
        where: { id: package_id },
        include: { teachers: true }
      });

      if (!classPackage) {
        throw new Error('Package not found');
      }

      if (classPackage.teacher_id !== teacher_id) {
        throw new Error('Package does not belong to the specified teacher');
      }

      classesCount = classPackage.classes_count;
      validityDays = classPackage.validity_days;
    } else {
      // New flow: dynamic session count without a package
      classesCount = requestedSessions || sessions_to_pay;
      if (!classesCount || classesCount <= 0) {
        throw new Error('Please specify the number of sessions');
      }
      // Validity: 7 days per session, minimum 30 days, maximum 365 days
      validityDays = Math.min(365, Math.max(30, classesCount * 7));
    }

    // Ensure sessions_to_pay doesn't exceed total
    const effectiveSessionsToPay = Math.min(sessions_to_pay, classesCount);

    if (effectiveSessionsToPay <= 0) {
      throw new Error('Please specify the number of sessions to pay for');
    }

    // Fetch student details
    const student = await prisma.students.findUnique({
      where: { id: student_id },
      select: {
        id: true,
        name: true,
        guardian_phone: true,
        profiles: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate pricing using the formula (server-side validation)
    // Look up the teacher's base price for the selected instrument + level
    const teacherInstrument = await prisma.teacher_instruments.findFirst({
      where: {
        teacher_id,
        instrument,
        teach_or_perform: { in: ['teach', 'Teach'] },
      },
      include: {
        teacher_instrument_tiers: {
          where: { level: level as any },
        },
      },
    }) as any;

    let totalPackagePrice: number;
    let pricePerSession: number;

    if (teacherInstrument?.teacher_instrument_tiers?.[0]) {
      const tier = teacherInstrument.teacher_instrument_tiers[0];
      const teacherBasePrice = tier.price_inr != null
        ? (typeof tier.price_inr === 'object' && typeof tier.price_inr.toNumber === 'function'
          ? tier.price_inr.toNumber()
          : Number(tier.price_inr))
        : null;

      if (teacherBasePrice && teacherBasePrice > 0) {
        // Fetch teacher's custom markup config
        const teacher = await prisma.teachers.findUnique({
          where: { id: teacher_id },
          select: {
            custom_markup_pct_single: true,
            custom_markup_pct_10: true,
            custom_markup_pct_20: true,
            custom_markup_pct_30: true,
            custom_rounding_single: true,
            custom_rounding_10: true,
            custom_rounding_20: true,
            custom_rounding_30: true,
          },
        }) as any;

        const pricingConfig = teacher ? buildPricingConfig(teacher) : null;

        pricePerSession = computePerClassPrice(teacherBasePrice, classesCount, pricingConfig ?? undefined);
        totalPackagePrice = pricePerSession * classesCount;
      } else {
        throw new Error('Teacher pricing not configured for this instrument and level');
      }
    } else {
      throw new Error('Teacher pricing not found for the selected instrument and level');
    }

    const amountToPay = pricePerSession * effectiveSessionsToPay;
    const amountInPaisa = Math.round(amountToPay * 100); // Razorpay expects amount in paisa

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    // Create purchased package in PENDING status
    const purchasedPackage = await prisma.purchased_packages.create({
      data: {
        student_id,
        package_id: package_id || null,
        teacher_id,
        instrument,
        level,
        mode,
        classes_total: classesCount,
        classes_remaining: classesCount,
        classes_completed: 0,
        total_package_price: totalPackagePrice,
        price_per_session: pricePerSession,
        payment_option: payment_option as payment_option_type,
        sessions_paid: 0,
        amount_paid: 0,
        amount_remaining: totalPackagePrice,
        expires_at: expiresAt,
        status: 'PENDING'
      }
    });

    // Create Razorpay order
    const razorpayOrder = await getRazorpayInstance().orders.create({
      amount: amountInPaisa,
      currency: 'INR',
      receipt: `pkg_${purchasedPackage.id.substring(0, 8)}`,
      notes: {
        purchased_package_id: purchasedPackage.id,
        student_id,
        teacher_id,
        sessions_covered: effectiveSessionsToPay.toString(),
        payment_option
      }
    });

    // Create payment record with scheduled sessions data
    await prisma.purchase_payments.create({
      data: {
        purchased_package_id: purchasedPackage.id,
        razorpay_order_id: razorpayOrder.id,
        amount: amountToPay,
        currency: 'INR',
        sessions_covered: effectiveSessionsToPay,
        status: 'PENDING',
        metadata: {
          scheduled_sessions: scheduled_sessions
        }
      }
    });

    // Get student details for checkout
    const studentName = student.name || student.profiles?.name || 'Student';
    const studentEmail = student.profiles ? 
      (await prisma.users.findUnique({ where: { id: student_id } }))?.email || '' : '';

    return {
      purchase_id: purchasedPackage.id,
      razorpay_order_id: razorpayOrder.id,
      amount: amountToPay,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID || '',
      student_name: studentName,
      student_email: studentEmail,
      student_phone: student.guardian_phone || undefined
    };
  }

  /**
   * Verifies Razorpay payment signature and activates the package
   */
  async verifyPayment(data: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, purchased_package_id } = data;

    // Step 1: Verify signature
    const isValidSignature = this.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValidSignature) {
      // Update payment status to failed
      await prisma.purchase_payments.updateMany({
        where: { razorpay_order_id },
        data: { status: 'FAILED' }
      });
      await this.markPendingPackageFailed(purchased_package_id, 'invalid_signature');
      throw new Error('Payment verification failed - invalid signature');
    }

    // Step 2: Fetch payment record
    const paymentRecord = await prisma.purchase_payments.findFirst({
      where: { razorpay_order_id },
      include: { purchased_packages: true }
    });

    if (!paymentRecord) {
      throw new Error('Payment record not found');
    }

    if (paymentRecord.purchased_package_id !== purchased_package_id) {
      throw new Error('Package mismatch');
    }

    if (paymentRecord.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Payment already processed',
        purchase: {
          id: purchased_package_id,
          status: 'ACTIVE',
          sessions_booked: paymentRecord.sessions_covered
        },
        bookings: []
      };
    }

    // Step 3: Fetch payment details from Razorpay to verify amount
    const razorpayPayment = await getRazorpayInstance().payments.fetch(razorpay_payment_id);
    const paidAmount = Number(razorpayPayment.amount) / 100; // Convert from paisa

    if (paidAmount !== Number(paymentRecord.amount)) {
      await prisma.purchase_payments.update({
        where: { id: paymentRecord.id },
        data: { status: 'FAILED', metadata: { error: 'Amount mismatch', expected: paymentRecord.amount, received: paidAmount } }
      });
      await this.markPendingPackageFailed(purchased_package_id, 'amount_mismatch');
      throw new Error('Payment amount mismatch');
    }

    // Step 4: Update payment record
    // Preserve the scheduled_sessions from original metadata
    const scheduledSessions = (paymentRecord.metadata as any)?.scheduled_sessions || [];
    
    await prisma.purchase_payments.update({
      where: { id: paymentRecord.id },
      data: {
        razorpay_payment_id,
        razorpay_signature,
        status: 'SUCCESS',
        payment_method: razorpayPayment.method,
        completed_at: new Date(),
        metadata: {
          scheduled_sessions: scheduledSessions,
          razorpay_response: JSON.parse(JSON.stringify(razorpayPayment))
        }
      }
    });

    // Step 5: Update purchased package
    const purchasedPackage = paymentRecord.purchased_packages;
    const newAmountPaid = Number(purchasedPackage.amount_paid) + paidAmount;
    const newSessionsPaid = purchasedPackage.sessions_paid + paymentRecord.sessions_covered;

    await prisma.purchased_packages.update({
      where: { id: purchased_package_id },
      data: {
        status: 'ACTIVE',
        amount_paid: newAmountPaid,
        amount_remaining: Number(purchasedPackage.total_package_price) - newAmountPaid,
        sessions_paid: newSessionsPaid
      }
    });

    // Step 6: Create bookings from stored scheduled sessions
    const bookingsCreated = await this.createBookingsFromScheduledSessions(
      purchasedPackage.student_id,
      purchasedPackage.teacher_id,
      purchased_package_id,
      scheduledSessions
    );

    // Step 7: Fetch created bookings to return to frontend
    const createdBookings = await prisma.bookings.findMany({
      where: { purchased_package_id },
      select: {
        id: true,
        scheduled_at: true,
        duration_minutes: true
      },
      orderBy: { scheduled_at: 'asc' }
    });

    void ActivityNotificationService.notifyPackagePurchased(purchased_package_id).catch((error) => {
      console.error('Failed to send package purchase notification:', error);
    });

    return {
      success: true,
      message: 'Payment verified successfully',
      purchase: {
        id: purchased_package_id,
        status: 'ACTIVE',
        sessions_booked: bookingsCreated
      },
      bookings: createdBookings.map(b => {
        const startTime = b.scheduled_at.toISOString().split('T')[1].substring(0, 5);
        const endDate = new Date(new Date(b.scheduled_at).getTime() + (b.duration_minutes || 60) * 60000);
        const endTime = endDate.toISOString().split('T')[1].substring(0, 5);
        return {
          id: b.id,
          date: b.scheduled_at.toISOString().split('T')[0],
          start_time: startTime,
          end_time: endTime
        };
      })
    };
  }

  async markCheckoutAbandoned(data: MarkCheckoutAbandonedRequest, studentId: string) {
    const { razorpay_order_id, purchased_package_id } = data;

    const purchasedPackage = await prisma.purchased_packages.findUnique({
      where: { id: purchased_package_id },
      select: {
        id: true,
        student_id: true,
        status: true,
      },
    });

    if (!purchasedPackage) {
      throw new Error('Package not found');
    }

    if (purchasedPackage.student_id !== studentId) {
      throw new Error('Unauthorized');
    }

    if (purchasedPackage.status !== 'PENDING') {
      return { success: true, message: 'No pending package to cancel' };
    }

    await prisma.purchase_payments.updateMany({
      where: {
        purchased_package_id,
        razorpay_order_id,
        status: 'PENDING',
      },
      data: {
        status: 'FAILED',
        metadata: {
          error: 'Checkout dismissed by user',
          dismissed_at: new Date().toISOString(),
        },
      },
    });

    await this.markPendingPackageFailed(purchased_package_id, 'checkout_dismissed');

    return { success: true, message: 'Pending checkout marked as failed' };
  }

  /**
   * Verifies Razorpay signature using HMAC SHA256
   */
  private verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error('Razorpay secret not configured');
      return false;
    }

    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Creates bookings from stored scheduled sessions (specific dates/times from cart)
   */
  private async createBookingsFromScheduledSessions(
    studentId: string,
    teacherId: string,
    purchasedPackageId: string,
    scheduledSessions: Array<{ date: string; start_time: string; end_time: string }>
  ): Promise<number> {
    let bookingsCreated = 0;

    for (const session of scheduledSessions) {
      try {
        // Generate a unique meeting link for each session
        const meetingId = nanoid(12);
        const meetingLink = `https://meet.jit.si/Maestera-Session-${meetingId}`;

        // Calculate duration in minutes
        const [startHour, startMin] = session.start_time.split(':').map(Number);
        const [endHour, endMin] = session.end_time.split(':').map(Number);
        const duration_minutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);

        // Create booking with scheduled datetime
        const scheduledAt = new Date(`${session.date}T${session.start_time}:00`);

        await prisma.bookings.create({
          data: {
            student_id: studentId,
            teacher_id: teacherId,
            purchased_package_id: purchasedPackageId,
            booking_type: 'PACKAGE',
            scheduled_at: scheduledAt,
            duration_minutes,
            meeting_link: meetingLink,
            is_demo: false,
            status: 'SCHEDULED'
          }
        });

        bookingsCreated++;
      } catch (err) {
        console.error('❌ Error creating booking for session:', session, err);
      }
    }

    return bookingsCreated;
  }

  /**
   * Creates bookings for the specified number of sessions based on scheduled slots
   */
  private async createBookingsForSessions(
    purchasedPackageId: string,
    sessionsToCreate: number
  ): Promise<number> {
    // Fetch package and scheduled sessions
    const purchasedPackage = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
      include: {
        scheduled_sessions: {
          where: { is_active: true },
          orderBy: { day_of_week: 'asc' }
        }
      }
    });

    if (!purchasedPackage || purchasedPackage.scheduled_sessions.length === 0) {
      console.error('No scheduled sessions found for package');
      return 0;
    }

    const slots = purchasedPackage.scheduled_sessions;
    let bookingsCreated = 0;
    let slotIndex = 0;

    // Find the first session date
    let currentDate = this.getNextDateForDayOfWeek(new Date(), slots[0].day_of_week);

    // Update first_session_date if not set
    if (!purchasedPackage.first_session_date) {
      await prisma.purchased_packages.update({
        where: { id: purchasedPackageId },
        data: { first_session_date: currentDate }
      });
    }

    while (bookingsCreated < sessionsToCreate) {
      const slot = slots[slotIndex % slots.length];

      // Get next occurrence of this slot's day
      const bookingDate = this.getNextDateForDayOfWeek(currentDate, slot.day_of_week);
      
      // Parse time and create full datetime
      const [hours, minutes] = slot.start_time.split(':').map(Number);
      const scheduledAt = new Date(bookingDate);
      scheduledAt.setHours(hours, minutes, 0, 0);

      // Create the booking
      await prisma.bookings.create({
        data: {
          student_id: purchasedPackage.student_id,
          teacher_id: purchasedPackage.teacher_id,
          purchased_package_id: purchasedPackageId,
          booking_type: 'package_session',
          status: 'SCHEDULED',
          scheduled_at: scheduledAt,
          duration_minutes: slot.duration_minutes,
          is_demo: false
        }
      });

      bookingsCreated++;
      slotIndex++;

      // Move to next week when we've gone through all slots
      if (slotIndex % slots.length === 0) {
        currentDate = new Date(bookingDate);
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        // Move currentDate forward to at least the booking date
        currentDate = new Date(bookingDate);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Update classes_remaining
    await prisma.purchased_packages.update({
      where: { id: purchasedPackageId },
      data: {
        classes_remaining: purchasedPackage.classes_remaining - bookingsCreated
      }
    });

    return bookingsCreated;
  }

  /**
   * Gets the next date that falls on the specified day of week
   */
  private getNextDateForDayOfWeek(fromDate: Date, targetDayOfWeek: number): Date {
    const result = new Date(fromDate);
    result.setHours(0, 0, 0, 0);
    
    const currentDay = result.getDay();
    let daysToAdd = targetDayOfWeek - currentDay;
    
    if (daysToAdd < 0) {
      daysToAdd += 7;
    }
    
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  /**
   * Creates an order for the next tranche of flexible payments
   */
  async createNextTranchePayment(purchasedPackageId: string): Promise<CreateOrderResponse> {
    const purchasedPackage = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
      include: {
        students: { include: { profiles: true } },
        class_packages: true
      }
    });

    if (!purchasedPackage) {
      throw new Error('Package not found');
    }

    if (purchasedPackage.status !== 'ACTIVE') {
      throw new Error('Package is not active');
    }

    if (purchasedPackage.payment_option !== 'FLEXIBLE') {
      throw new Error('This package uses upfront payment');
    }

    // Calculate remaining sessions to pay
    const remainingSessions = purchasedPackage.classes_total - purchasedPackage.sessions_paid;
    if (remainingSessions <= 0) {
      throw new Error('All sessions already paid');
    }

    // Determine sessions for this tranche (4 or remaining if less)
    const sessionsForTranche = Math.min(4, remainingSessions);
    const amountToPay = Number(purchasedPackage.price_per_session) * sessionsForTranche;
    const amountInPaisa = Math.round(amountToPay * 100);

    // Create Razorpay order
    const razorpayOrder = await getRazorpayInstance().orders.create({
      amount: amountInPaisa,
      currency: 'INR',
      receipt: `tranche_${purchasedPackage.id.substring(0, 8)}`,
      notes: {
        purchased_package_id: purchasedPackage.id,
        student_id: purchasedPackage.student_id,
        teacher_id: purchasedPackage.teacher_id,
        sessions_covered: sessionsForTranche.toString(),
        payment_type: 'tranche'
      }
    });

    // Create payment record
    await prisma.purchase_payments.create({
      data: {
        purchased_package_id: purchasedPackage.id,
        razorpay_order_id: razorpayOrder.id,
        amount: amountToPay,
        currency: 'INR',
        sessions_covered: sessionsForTranche,
        status: 'PENDING'
      }
    });

    // Get student details
    const student = purchasedPackage.students;
    const studentName = student?.name || student?.profiles?.name || 'Student';
    const studentEmail = student?.profiles ?
      (await prisma.users.findUnique({ where: { id: purchasedPackage.student_id } }))?.email || '' : '';

    return {
      purchase_id: purchasedPackage.id,
      razorpay_order_id: razorpayOrder.id,
      amount: amountToPay,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID || '',
      student_name: studentName,
      student_email: studentEmail,
      student_phone: student?.guardian_phone || undefined
    };
  }

  /**
   * Gets package details with payment history
   */
  async getPackageDetails(purchasedPackageId: string) {
    return prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId },
      include: {
        class_packages: true,
        teachers: {
          select: {
            id: true,
            name: true,
            profile_picture: true
          }
        },
        purchase_payments: {
          orderBy: { created_at: 'desc' }
        },
        scheduled_sessions: true,
        bookings: {
          orderBy: { scheduled_at: 'asc' }
        }
      }
    });
  }

  /**
   * Gets all packages for a student
   */
  async getStudentPackages(studentId: string) {
    return prisma.purchased_packages.findMany({
      where: { student_id: studentId },
      include: {
        class_packages: true,
        teachers: {
          select: {
            id: true,
            name: true,
            profile_picture: true
          }
        },
        purchase_payments: {
          where: { status: 'SUCCESS' },
          orderBy: { created_at: 'desc' }
        },
        scheduled_sessions: {
          where: { is_active: true },
          orderBy: { day_of_week: 'asc' }
        },
        bookings: {
          where: {
            status: { not: 'CANCELLED' }
          },
          orderBy: { scheduled_at: 'asc' }
        }
      },
      orderBy: { purchased_at: 'desc' }
    });
  }

  /**
   * Cancels a package and processes refund if applicable
   */
  async cancelPackage(purchasedPackageId: string, studentId: string) {
    const purchasedPackage = await prisma.purchased_packages.findUnique({
      where: { id: purchasedPackageId }
    });

    if (!purchasedPackage) {
      throw new Error('Package not found');
    }

    if (purchasedPackage.student_id !== studentId) {
      throw new Error('Unauthorized');
    }

    if (purchasedPackage.status === 'CANCELLED') {
      throw new Error('Package already cancelled');
    }

    // Cancel all pending bookings
    await prisma.bookings.updateMany({
      where: {
        purchased_package_id: purchasedPackageId,
        status: 'SCHEDULED'
      },
      data: {
        status: 'CANCELLED'
      }
    });

    // Update package status
    await prisma.purchased_packages.update({
      where: { id: purchasedPackageId },
      data: { status: 'CANCELLED' }
    });

    // TODO: Implement refund logic via Razorpay if needed
    // This would involve calling razorpay.payments.refund()

    return { success: true, message: 'Package cancelled successfully' };
  }
}

export const paymentService = new PaymentService();
