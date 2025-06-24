const jwt = require('jsonwebtoken');
const { db, supabase } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

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

    console.log('Token found, attempting to verify...');

    // First try to verify as Supabase token
    try {
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
      
      if (!error && supabaseUser) {
        console.log('Token verified as Supabase token for user:', supabaseUser.id);
        
        // Get user from database
        const [user] = await db.select().from(users).where(eq(users.id, supabaseUser.id));
        
        if (!user) {
          console.log('User not found in database for Supabase user:', supabaseUser.id);
          return res.status(401).json({ message: 'User not found.' });
        }

        // Remove password from user object
        const { password: _, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
        
        console.log('Auth successful with Supabase token for user:', user.id);
        return next();
      }
    } catch (supabaseError) {
      console.log('Token is not a valid Supabase token, trying JWT...');
    }

    // If Supabase verification failed, try JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      console.log('Token verified as JWT for user:', decoded.id);
      
      // Get user from database
      const [user] = await db.select().from(users).where(eq(users.id, decoded.id));
      
      if (!user) {
        console.log('User not found in database for JWT user:', decoded.id);
        return res.status(401).json({ message: 'User not found.' });
      }

      // Remove password from user object
      const { password: _, ...userWithoutPassword } = user;
      req.user = userWithoutPassword;
      
      console.log('Auth successful with JWT token for user:', user.id);
      return next();
    } catch (jwtError) {
      console.log('Token is not a valid JWT either');
      return res.status(401).json({ message: 'Invalid token.' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    
    res.status(500).json({ message: 'Server error during authentication.' });
  }
};

module.exports = { auth };