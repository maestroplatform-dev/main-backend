import Razorpay from 'razorpay';

// Lazily initialize Razorpay instance only when needed
let razorpayInstance: Razorpay | null = null;

export function getRazorpayInstance(): Razorpay {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured');
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

// Validate Razorpay configuration
export function validateRazorpayConfig(): boolean {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.warn('⚠️ Razorpay credentials not configured. Payment features will not work.');
    return false;
  }
  return true;
}

// Export default for backwards compatibility (but it's lazy)
export default {
  orders: {
    create: async (data: any) => getRazorpayInstance().orders.create(data),
    fetch: async (id: string) => getRazorpayInstance().orders.fetch(id),
  },
  payments: {
    fetch: async (id: string) => getRazorpayInstance().payments.fetch(id),
  },
};

