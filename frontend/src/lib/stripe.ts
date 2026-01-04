import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error('Missing Stripe publishable key');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};

export const subscriptionPlans = {
  basic: {
    id: 'price_basic',
    name: 'Basic Plan',
    price: 115,
    interval: 'month',
    features: [
      'Access to document uploads',
      'Dashboard and project management',
      'Manual QC data tools',
      'Basic reporting',
      'Email support'
    ]
  },
  premium: {
    id: 'price_premium',
    name: 'Premium Plan',
    price: 145,
    interval: 'month',
    features: [
      'Everything in Basic',
      '2D automation features',
      'CAD downloads and integration',
      'AI document analysis and suggestions',
      'Real-time collaboration',
      'Priority support'
    ]
  }
};
