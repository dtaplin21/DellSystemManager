const { supabase, db, pool } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const config = require('../config/env');
const logger = require('../lib/logger');

const DEV_BYPASS_HEADER = 'x-dev-bypass';

const auth = async (req, res, next) => {
  try {
    logger.debug('[AUTH] Middleware invoked', {
      method: req.method,
      path: req.path,
      hasAuthorizationHeader: Boolean(req.headers?.authorization)
    });
    
    if (config.isDevelopment && req.headers[DEV_BYPASS_HEADER] === 'true') {
      logger.warn('[AUTH] Development bypass enabled - using mock authentication');
      try {
        const result = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', ['dev@example.com']);
        
        if (result.rows.length > 0) {
          req.user = {
            id: result.rows[0].id,
            email: 'dev@example.com',
            displayName: 'Development User',
            company: 'Development Company',
            subscription: 'premium',
            isAdmin: true,
            profileImageUrl: null
          };
          logger.debug('[AUTH] Development bypass using real user ID', { userId: req.user.id });
          return next();
        }
      } catch (error) {
        logger.warn('[AUTH] Development bypass failed to fetch dev user', {
          error: {
            message: error.message,
            stack: config.isDevelopment ? error.stack : undefined
          }
        });
      }
      
      req.user = {
        id: 'dev-user-123',
        email: 'dev@example.com',
        displayName: 'Development User',
        company: 'Development Company',
        subscription: 'premium',
        isAdmin: true,
        profileImageUrl: null
      };
      return next();
    }
    
    const authorizationHeader = req.headers?.authorization;
    let token = null;
    
    if (authorizationHeader) {
      token = authorizationHeader.replace('Bearer ', '');
      logger.debug('[AUTH] Token extracted from Authorization header', {
        tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
      });
    }
    
    if (!token) {
      logger.warn('[AUTH] Missing Authorization header');
      return res.status(401).json({
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN'
      });
    }
    
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      if (error.message.includes('expired')) {
        return res.status(401).json({
          message: 'Token expired. Please refresh your session.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (error.message.includes('invalid')) {
        return res.status(401).json({
          message: 'Invalid token. Please log in again.',
          code: 'INVALID_TOKEN'
        });
      }
      
      return res.status(401).json({
        message: 'Authentication failed.',
        code: 'AUTH_FAILED'
      });
    }
    
    if (!supabaseUser) {
      logger.warn('[AUTH] Token verification returned no user');
      return res.status(401).json({
        message: 'Invalid token. No user found.',
        code: 'NO_USER'
      });
    }
    
    logger.debug('[AUTH] Token verified with Supabase', { userId: supabaseUser.id });
    
    const [userProfile] = await db
      .select()
      .from(users)
      .where(eq(users.id, supabaseUser.id));
    
    if (!userProfile) {
      logger.warn('[AUTH] User not found in database', { userId: supabaseUser.id });
      return res.status(401).json({
        message: 'User not found in database',
        code: 'USER_NOT_FOUND'
      });
    }
    
    req.user = {
      id: supabaseUser.id,
      email: supabaseUser.email,
      displayName: userProfile.displayName || supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
      company: userProfile.company || supabaseUser.user_metadata?.company || null,
      subscription: userProfile.subscription || supabaseUser.user_metadata?.subscription || 'basic',
      isAdmin: userProfile.isAdmin || false,
      profileImageUrl: userProfile.profileImageUrl || supabaseUser.user_metadata?.avatar_url || null
    };
    
    logger.debug('[AUTH] Authentication successful', {
      userId: req.user.id,
      email: req.user.email,
      isAdmin: req.user.isAdmin,
      subscription: req.user.subscription
    });
    
    return next();
  } catch (error) {
    logger.error('[AUTH] Middleware error', {
      error: {
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    
    return res.status(500).json({
      message: 'Server error during authentication.',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = { auth };
