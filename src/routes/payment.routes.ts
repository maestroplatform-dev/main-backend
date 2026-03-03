import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Get Razorpay config (key ID) - public endpoint
router.get('/config', paymentController.getConfig.bind(paymentController));

// Validate schedule - public endpoint (check teacher availability)
router.post('/validate-schedule', paymentController.validateSchedule.bind(paymentController));

// Protected routes - require authentication
router.use(authenticateUser);

// Create order for package purchase
router.post('/create-order', paymentController.createOrder.bind(paymentController));

// Verify payment after Razorpay checkout
router.post('/verify-payment', paymentController.verifyPayment.bind(paymentController));

// Mark checkout as dismissed/failed when user closes Razorpay modal
router.post('/checkout-dismissed', paymentController.checkoutDismissed.bind(paymentController));

// Create next tranche payment for flexible option
router.post('/create-next-payment', paymentController.createNextTranchePayment.bind(paymentController));

// Get all packages for the student
router.get('/packages', paymentController.getStudentPackages.bind(paymentController));

// Get specific package details
router.get('/packages/:packageId', paymentController.getPackageDetails.bind(paymentController));

// Cancel a package
router.post('/packages/:packageId/cancel', paymentController.cancelPackage.bind(paymentController));

export default router;
