// Middleware to check subscription tier
const subscriptionCheck = (requiredTier) => {
  return (req, res, next) => {
    console.log('🔍 Subscription check for tier:', requiredTier);
    console.log('🔍 User data:', {
      id: req.user?.id,
      email: req.user?.email,
      isAdmin: req.user?.isAdmin,
      subscription: req.user?.subscription
    });
    
    // Check if user is authenticated - auth middleware should run first
    if (!req.user) {
      console.log('❌ No user found in subscription check');
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Admin users bypass all subscription checks
    if (req.user.isAdmin === true) {
      console.log('🔓 Admin user bypassing subscription check:', req.user.id);
      return next();
    }
    
    console.log('⚠️ User is not admin, checking subscription...');
    
    // Basic checks for any valid subscription
    if (!req.user.subscription) {
      console.log('❌ No subscription found for user');
      return res.status(403).json({ 
        message: 'No active subscription',
        requiredTier
      });
    }
    
    // Premium features check
    if (requiredTier === 'premium' && req.user.subscription !== 'premium') {
      console.log('❌ Premium subscription required, user has:', req.user.subscription);
      return res.status(403).json({ 
        message: 'This feature requires a premium subscription',
        currentTier: req.user.subscription,
        requiredTier
      });
    }
    
    console.log('✅ Subscription check passed');
    next();
  };
};

module.exports = { subscriptionCheck };
