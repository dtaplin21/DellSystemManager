const { supabase, pool, queryWithRetry } = require('../db');
const config = require('../config/env');
const logger = require('../lib/logger');

const DEV_BYPASS_HEADER = 'x-dev-bypass';

const auth = async (req, res, next) => {
  try {
    // Check for development bypass header (case-insensitive)
    const bypassHeader = req.headers['x-dev-bypass'] || req.headers['X-Dev-Bypass'] || req.headers['X-DEV-BYPASS'];
    
    logger.debug('[AUTH] Middleware invoked', {
      method: req.method,
      path: req.path,
      hasAuthorizationHeader: Boolean(req.headers?.authorization),
      hasDevBypass: Boolean(bypassHeader),
      devBypassValue: bypassHeader,
      isDevelopment: config.isDevelopment
    });
    
    if (config.isDevelopment && bypassHeader === 'true') {
      logger.warn('[AUTH] Development bypass enabled - using mock authentication');
      try {
        // Try to get any user from the database first with retry logic
        const result = await queryWithRetry(
          'SELECT id, email, display_name, company, subscription, is_admin FROM users LIMIT 1',
          [],
          2 // Only 2 retries for dev bypass
        );
        
        if (result.rows.length > 0) {
          const dbUser = result.rows[0];
          req.user = {
            id: dbUser.id,
            email: dbUser.email || 'dev@example.com',
            displayName: dbUser.display_name || 'Development User',
            company: dbUser.company || 'Development Company',
            subscription: dbUser.subscription || 'premium',
            isAdmin: dbUser.is_admin || true,
            profileImageUrl: null
          };
          logger.debug('[AUTH] Development bypass using real user ID from database', { userId: req.user.id });
          return next(); // CRITICAL: Return here to prevent Supabase call
        }
      } catch (error) {
        logger.warn('[AUTH] Development bypass failed to fetch user from database', {
          error: {
            message: error.message,
            stack: config.isDevelopment ? error.stack : undefined
          }
        });
      }
      
      // Fallback: Use a valid UUID format for dev user
      // This is a well-known UUID v4 that can be used for development
      req.user = {
        id: '00000000-0000-0000-0000-000000000001', // Valid UUID format
        email: 'dev@example.com',
        displayName: 'Development User',
        company: 'Development Company',
        subscription: 'premium',
        isAdmin: true,
        profileImageUrl: null
      };
      logger.debug('[AUTH] Development bypass using fallback UUID', { userId: req.user.id });
      return next(); // CRITICAL: Return here to prevent Supabase call
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
    
    let supabaseUser;
    let supabaseError;
    
    try {
      const result = await supabase.auth.getUser(token);
      supabaseUser = result.data?.user;
      supabaseError = result.error;
    } catch (fetchError) {
      // Handle network/timeout errors
      const isTimeoutError = fetchError.message?.includes('timeout') || 
                            fetchError.message?.includes('fetch failed') ||
                            fetchError.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                            fetchError.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
      
      if (isTimeoutError) {
        logger.error('[AUTH] Supabase connection timeout - this may be a network issue', {
          error: fetchError.message,
          code: fetchError.code,
          cause: fetchError.cause
        });
        
        // In development, fall back to bypass if Supabase is unreachable
        if (config.isDevelopment) {
          logger.warn('[AUTH] Falling back to development bypass due to Supabase timeout');
          req.user = {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'dev@example.com',
            displayName: 'Development User',
            company: 'Development Company',
            subscription: 'premium',
            isAdmin: true,
            profileImageUrl: null
          };
          return next();
        }
        
        return res.status(503).json({
          message: 'Authentication service unavailable. Please try again later.',
          code: 'AUTH_SERVICE_UNAVAILABLE'
        });
      }
      
      // Re-throw other fetch errors
      throw fetchError;
    }
    
    if (supabaseError) {
      if (supabaseError.message?.includes('expired')) {
        return res.status(401).json({
          message: 'Token expired. Please refresh your session.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (supabaseError.message?.includes('invalid')) {
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
    
    // Use direct PostgreSQL query with retry logic for better error handling and timeout control
    // This avoids connection pool issues and handles transient connection failures
    let userProfile;
    try {
      const result = await queryWithRetry(
        `SELECT id, email, display_name, company, subscription, is_admin, profile_image_url 
         FROM users 
         WHERE id = $1 
         LIMIT 1`,
        [supabaseUser.id],
        3 // 3 retries with exponential backoff
      );
      
      userProfile = result.rows[0] || null;
    } catch (dbError) {
      logger.error('[AUTH] Database query failed when fetching user profile after retries', {
        userId: supabaseUser.id,
        error: {
          message: dbError.message,
          code: dbError.code,
          stack: config.isDevelopment ? dbError.stack : undefined
        },
        poolState: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount
        }
      });
      
      // If it's a connection/timeout error, return a more specific error
      if (dbError.message.includes('timeout') || 
          dbError.message.includes('Connection terminated') ||
          dbError.message.includes('ECONNREFUSED') ||
          dbError.message.includes('ENOTFOUND')) {
        return res.status(503).json({
          message: 'Database connection timeout. Please try again.',
          code: 'DATABASE_TIMEOUT',
          retryable: true
        });
      }
      
      // For other database errors, return generic error
      return res.status(500).json({
        message: 'Database error during authentication.',
        code: 'DATABASE_ERROR'
      });
    }
    
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
      displayName: userProfile.display_name || supabaseUser.user_metadata?.display_name || supabaseUser.email?.split('@')[0],
      company: userProfile.company || supabaseUser.user_metadata?.company || null,
      subscription: userProfile.subscription || supabaseUser.user_metadata?.subscription || 'basic',
      isAdmin: userProfile.is_admin || false,
      profileImageUrl: userProfile.profile_image_url || supabaseUser.user_metadata?.avatar_url || null
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
