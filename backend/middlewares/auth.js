const { supabase, db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

const auth = async (req, res, next) => {
  try {
    console.log('🔐 [AUTH] Authentication middleware called for:', req.method, req.path);
    console.log('🔐 [AUTH] Request headers:', {
      authorization: req.headers?.authorization ? 'Present' : 'Missing',
      contentType: req.headers?.['content-type'],
      userAgent: req.headers?.['user-agent']?.substring(0, 50) + '...'
    });
    
    // Check if we're in development mode and allow bypass
    if (process.env.NODE_ENV === 'development' && req.headers['x-dev-bypass'] === 'true') {
      console.log('🔧 [DEV] Development bypass enabled - creating mock user');
      
      // Get the actual user ID from the database
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      try {
        const client = await pool.connect();
        const result = await client.query('SELECT id FROM users WHERE email = $1', ['dev@example.com']);
        client.release();
        await pool.end();
        
        if (result.rows.length > 0) {
          req.user = {
            id: result.rows[0].id,
            email: 'dev@example.com',
            displayName: 'Development User',
            company: 'Development Company',
            subscription: 'premium',
            isAdmin: true,
            profileImageUrl: null,
          };
          console.log('🔧 [DEV] Using real user ID:', req.user.id);
          return next();
        }
      } catch (error) {
        console.error('🔧 [DEV] Error getting user ID:', error);
      }
      
      // Fallback to mock user
      req.user = {
        id: 'dev-user-123',
        email: 'dev@example.com',
        displayName: 'Development User',
        company: 'Development Company',
        subscription: 'premium',
        isAdmin: true,
        profileImageUrl: null,
      };
      return next();
    }
    
    // Enhanced debugging for authorization header
    if (req.headers?.authorization) {
      console.log('🔐 [AUTH] Authorization header details:', {
        fullHeader: req.headers.authorization,
        headerLength: req.headers.authorization.length,
        startsWithBearer: req.headers.authorization.startsWith('Bearer '),
        tokenPart: req.headers.authorization.replace('Bearer ', '').substring(0, 20) + '...'
      });
    }
    
    // Only check Authorization header for Supabase tokens
    let token = null;
    
    if (req.headers?.authorization) {
      token = req.headers.authorization.replace('Bearer ', '');
      console.log('🔐 [AUTH] Token extracted from Authorization header');
    }
    
    if (!token) {
      console.log('❌ [AUTH] No Authorization header provided in auth middleware');
      return res.status(401).json({ 
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }

    console.log('🔍 [AUTH] Token found in Authorization header, verifying with Supabase...');
    console.log('🔍 [AUTH] Token preview:', token.substring(0, 20) + '...');
    console.log('🔍 [AUTH] Token length:', token.length);

    // Verify the token with Supabase using server-side client
    console.log('🔍 [AUTH] Calling supabase.auth.getUser()...');
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    console.log('🔍 [AUTH] Supabase auth response:', {
      hasUser: !!supabaseUser,
      hasError: !!error,
      errorMessage: error?.message,
      userId: supabaseUser?.id
    });
    
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

    console.log('✅ [AUTH] Token verified as Supabase token for user:', supabaseUser.id);
    
    // Fetch complete user profile from database
    console.log('🔍 [AUTH] Fetching user profile from database for user:', supabaseUser.id);
    const [userProfile] = await db
      .select()
      .from(users)
      .where(eq(users.id, supabaseUser.id));
    
    console.log('🔍 [AUTH] User profile from database:', userProfile ? 'Found' : 'Not found');
    
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
    
    console.log('✅ [AUTH] Auth successful with Supabase token for user:', req.user.id);
    console.log('🔍 [AUTH] User details:', {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName,
      isAdmin: req.user.isAdmin,
      subscription: req.user.subscription
    });
    return next();
    
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({ 
      message: 'Server error during authentication.',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = { auth };