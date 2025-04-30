// Middleware to check subscription tier
const subscriptionCheck = (requiredTier) => {
  return (req, res, next) => {
    // Check if user is authenticated - auth middleware should run first
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Basic checks for any valid subscription
    if (!req.user.subscription) {
      return res.status(403).json({ 
        message: 'No active subscription',
        requiredTier
      });
    }
    
    // Premium features check
    if (requiredTier === 'premium' && req.user.subscription !== 'premium') {
      return res.status(403).json({ 
        message: 'This feature requires a premium subscription',
        currentTier: req.user.subscription,
        requiredTier
      });
    }
    
    next();
  };
};

module.exports = { subscriptionCheck };
