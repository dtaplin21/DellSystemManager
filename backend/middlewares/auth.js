const { supabase, db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

const auth = async (req, res, next) => {
  try {
    // Only check Authorization header for Supabase tokens
    let token = null;
    
    if (req.headers?.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
    }
    
    if (!token) {
      console.log('❌ No Authorization header provided in auth middleware');
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    console.log('🔍 Token found in Authorization header, verifying with Supabase...');
    console.log('🔍 Token preview:', token.substring(0, 20) + '...');

    // Verify the token with Supabase using server-side client
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.log('❌ Invalid Supabase token:', error.message);
      
      // Provide more specific error messages
      if (error.message.includes('expired')) {
        return res.status(401).json({ 
          message: 'Token expired. Please refresh your session.',
          code: 'TOKEN_EXPIRED'
        });
      } else if (error.message.includes('invalid')) {
        return res.status(401).json({ 
          message: 'Invalid token. Please log in again.',
          code: 'INVALID_TOKEN'
        });
      } else {
        return res.status(401).json({ 
          message: 'Authentication failed.',
          code: 'AUTH_FAILED'
        });
      }
    }
    
    if (!supabaseUser) {
      console.log('❌ No user returned from token verification');
      return res.status(401).json({ 
        message: 'Invalid token. No user found.',
        code: 'NO_USER'
      });
    }

    console.log('✅ Token verified as Supabase token for user:', supabaseUser.id);
    
    // Fetch complete user profile from database
    const [userProfile] = await db
      .select()
      .from(users)
      .where(eq(users.id, supabaseUser.id));
    
    // Set user info combining Supabase data with database profile
    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      displayName: userProfile?.displayName || supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
      company: userProfile?.company || supabaseUser.user_metadata?.company || null,
      subscription: userProfile?.subscription || supabaseUser.user_metadata?.subscription || 'basic',
      isAdmin: userProfile?.isAdmin || false,
      profileImageUrl: userProfile?.profileImageUrl || supabaseUser.user_metadata?.avatar_url || null,
    };
    
    console.log('✅ Auth successful with Supabase token for user:', req.user.id);
    console.log('🔍 User admin status:', req.user.isAdmin);
    return next();
    
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(500).json({ 
      message: 'Server error during authentication.',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = { auth };