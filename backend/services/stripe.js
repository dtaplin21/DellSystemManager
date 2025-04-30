// Initialize Stripe client conditionally
let stripeClient;

// Try to initialize Stripe only if the secret key is available
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe client initialized successfully');
  } else {
    console.warn('STRIPE_SECRET_KEY is not set. Stripe functionality will not work.');
    // Create a mock Stripe client that will gracefully return error responses
    stripeClient = {
      _isMock: true,
      products: { create: mockStripeFunction('products.create') },
      prices: { create: mockStripeFunction('prices.create') },
      subscriptions: { 
        retrieve: mockStripeFunction('subscriptions.retrieve'),
        list: mockStripeFunction('subscriptions.list'),
        cancel: mockStripeFunction('subscriptions.cancel'),
        update: mockStripeFunction('subscriptions.update')
      },
      customers: { create: mockStripeFunction('customers.create') }
    };
  }
} catch (error) {
  console.error('Error initializing Stripe client:', error);
  throw error;
}

// Helper function to create mock Stripe functions
function mockStripeFunction(name) {
  return async function() {
    const error = new Error(`Stripe ${name} failed: STRIPE_SECRET_KEY is not configured`);
    error.code = 'api_key_missing';
    throw error;
  };
}

// Helper to create a subscription price
async function createSubscriptionPrice(nickname, amount, interval = 'month') {
  try {
    // First create a product
    const product = await stripeClient.products.create({
      name: nickname,
      type: 'service',
    });
    
    // Then create a price for the product
    const price = await stripeClient.prices.create({
      product: product.id,
      unit_amount: amount * 100, // Convert to cents
      currency: 'usd',
      recurring: {
        interval,
      },
      nickname,
    });
    
    return { productId: product.id, priceId: price.id };
  } catch (error) {
    console.error('Error creating Stripe price:', error);
    throw error;
  }
}

// Helper to retrieve subscription
async function getSubscription(subscriptionId) {
  try {
    return await stripeClient.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error(`Error retrieving subscription ${subscriptionId}:`, error);
    throw error;
  }
}

// Helper to create a customer
async function createCustomer(email, name, metadata = {}) {
  try {
    return await stripeClient.customers.create({
      email,
      name,
      metadata,
    });
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
}

// Helper to get customer subscription
async function getCustomerSubscription(customerId) {
  try {
    const subscriptions = await stripeClient.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    
    return subscriptions.data.length > 0 ? subscriptions.data[0] : null;
  } catch (error) {
    console.error(`Error retrieving subscriptions for customer ${customerId}:`, error);
    throw error;
  }
}

// Helper to cancel subscription
async function cancelSubscription(subscriptionId, cancelImmediately = false) {
  try {
    if (cancelImmediately) {
      return await stripeClient.subscriptions.cancel(subscriptionId);
    } else {
      return await stripeClient.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  } catch (error) {
    console.error(`Error canceling subscription ${subscriptionId}:`, error);
    throw error;
  }
}

module.exports = {
  stripeClient,
  createSubscriptionPrice,
  getSubscription,
  createCustomer,
  getCustomerSubscription,
  cancelSubscription,
};
