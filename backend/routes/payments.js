const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { stripeClient } = require('../services/stripe');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

// Create a checkout session for subscription
router.post('/create-checkout-session', auth, async (req, res, next) => {
  try {
    const { planId } = req.body;
    
    // Validate plan ID
    if (!['basic', 'premium'].includes(planId)) {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }
    
    // Determine price based on plan
    const prices = {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      premium: process.env.STRIPE_PREMIUM_PRICE_ID,
    };
    
    const priceId = prices[planId];
    
    if (!priceId) {
      return res.status(400).json({ message: 'Price ID not configured for this plan' });
    }
    
    // Create or retrieve customer
    let customer;
    
    if (req.user.stripeCustomerId) {
      customer = await stripeClient.customers.retrieve(req.user.stripeCustomerId);
    } else {
      customer = await stripeClient.customers.create({
        email: req.user.email,
        name: req.user.displayName || req.user.email,
        metadata: {
          userId: req.user.id,
        },
      });
      
      // Save customer ID to user record
      await db
        .update(users)
        .set({ stripeCustomerId: customer.id })
        .where(eq(users.id, req.user.id));
    }
    
    // Create checkout session
    const session = await stripeClient.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/subscription?canceled=true`,
      metadata: {
        userId: req.user.id,
        planId,
      },
    });
    
    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    next(error);
  }
});

// Get subscription details
router.get('/subscription', auth, async (req, res, next) => {
  try {
    // Check if user has a Stripe customer ID
    if (!req.user.stripeCustomerId) {
      return res.status(200).json({ subscription: null });
    }
    
    // Retrieve customer's subscriptions
    const subscriptions = await stripeClient.subscriptions.list({
      customer: req.user.stripeCustomerId,
      status: 'active',
      limit: 1,
    });
    
    if (subscriptions.data.length === 0) {
      return res.status(200).json({ subscription: null });
    }
    
    const subscription = subscriptions.data[0];
    
    // Get plan details
    const priceId = subscription.items.data[0].price.id;
    
    // Map price ID to plan
    let plan = 'basic';
    if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) {
      plan = 'premium';
    }
    
    // Return subscription details
    res.status(200).json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        plan,
      },
    });
  } catch (error) {
    console.error('Stripe subscription retrieval error:', error);
    next(error);
  }
});

// Update subscription
router.patch('/subscription', auth, async (req, res, next) => {
  try {
    const { subscriptionId, planId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ message: 'Subscription ID is required' });
    }
    
    if (!planId || !['basic', 'premium'].includes(planId)) {
      return res.status(400).json({ message: 'Invalid plan ID' });
    }
    
    // Map plan to price ID
    const prices = {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      premium: process.env.STRIPE_PREMIUM_PRICE_ID,
    };
    
    const priceId = prices[planId];
    
    // Update subscription
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    
    // Verify the subscription belongs to this user
    if (subscription.customer !== req.user.stripeCustomerId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update subscription items
    const updatedSubscription = await stripeClient.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      metadata: {
        planId,
      },
    });
    
    // Update user's subscription in database
    await db
      .update(users)
      .set({ subscription: planId })
      .where(eq(users.id, req.user.id));
    
    res.status(200).json({
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        plan: planId,
      },
    });
  } catch (error) {
    console.error('Stripe subscription update error:', error);
    next(error);
  }
});

// Cancel subscription
router.delete('/subscription', auth, async (req, res, next) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ message: 'Subscription ID is required' });
    }
    
    // Retrieve subscription to verify ownership
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    
    // Verify the subscription belongs to this user
    if (subscription.customer !== req.user.stripeCustomerId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Cancel subscription at period end
    const canceledSubscription = await stripeClient.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    
    res.status(200).json({
      message: 'Subscription will be canceled at the end of the billing period',
      subscription: {
        id: canceledSubscription.id,
        status: canceledSubscription.status,
        currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error('Stripe subscription cancellation error:', error);
    next(error);
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  let event;
  
  try {
    event = stripeClient.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Check if this is a subscription checkout
      if (session.mode === 'subscription' && session.metadata.userId) {
        // Update user's subscription
        try {
          await db
            .update(users)
            .set({ 
              subscription: session.metadata.planId,
              stripeSubscriptionId: session.subscription,
            })
            .where(eq(users.id, session.metadata.userId));
          
          console.log(`Updated subscription for user ${session.metadata.userId} to ${session.metadata.planId}`);
        } catch (error) {
          console.error('Error updating user subscription:', error);
        }
      }
      break;
      
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object;
      
      // Find user by customer ID
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, subscription.customer));
        
        if (user) {
          let planId = 'basic'; // Default to basic if subscription is canceled/deleted
          
          if (subscription.status === 'active') {
            // Get plan from price ID
            const priceId = subscription.items.data[0].price.id;
            if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) {
              planId = 'premium';
            }
          }
          
          // Update user's subscription
          await db
            .update(users)
            .set({ subscription: planId })
            .where(eq(users.id, user.id));
          
          console.log(`Updated subscription for user ${user.id} to ${planId}`);
        }
      } catch (error) {
        console.error('Error handling subscription webhook:', error);
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
});

module.exports = router;
