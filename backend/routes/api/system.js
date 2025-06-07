const express = require('express');
const router = express.Router();
const { isOpenAIConfigured } = require('../../services/ai-connector');

/**
 * @route GET /api/system/health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * @route GET /api/system/services
 * @desc Get system services status
 * @access Public
 */
router.get('/services', async (req, res) => {
  try {
    // Check which services are available
    const services = {
      ai: {
        openai: isOpenAIConfigured(),
      },
      payment: {
        stripe: !!process.env.STRIPE_SECRET_KEY,
      },
      auth: {
        firebase: !!(process.env.VITE_FIREBASE_API_KEY && 
                     process.env.VITE_FIREBASE_PROJECT_ID && 
                     process.env.VITE_FIREBASE_APP_ID),
      }
    };

    // Create a list of missing services that might be needed
    const missingSecrets = [];
    
    if (!services.ai.openai) {
      missingSecrets.push('ai.openai');
    }
    
    if (!services.payment.stripe) {
      missingSecrets.push('payment.stripe');
    }
    
    if (!services.auth.firebase) {
      missingSecrets.push('auth.firebase');
    }

    res.json({
      services,
      missingSecrets,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting service status:', error);
    res.status(500).json({ error: 'Failed to get service status' });
  }
});

module.exports = router;