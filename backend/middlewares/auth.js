const { supabase } = require('../db');

const auth = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.token;
    
    // Also check Authorization header for localStorage tokens
    if (!token && req.headers?.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    
    if (!token) {
      console.log('No token provided in auth middleware');
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    console.log('Token found, attempting to verify with Supabase...');

    // Verify the token with Supabase
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    
    if (error || !supabaseUser) {
      console.log('Invalid Supabase token:', error?.message || 'No user returned');
      return res.status(401).json({ message: 'Invalid token.' });
    }

    console.log('Token verified as Supabase token for user:', supabaseUser.id);
    
    // Set user info from Supabase directly
    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      displayName: supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
      company: supabaseUser.user_metadata?.company || null,
      subscription: supabaseUser.user_metadata?.subscription || 'basic',
      profileImageUrl: supabaseUser.user_metadata?.avatar_url || null,
    };
    
    console.log('Auth successful with Supabase token for user:', req.user.id);
    return next();
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error during authentication.' });
  }
};

module.exports = { auth };