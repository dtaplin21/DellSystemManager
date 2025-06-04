const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

const auth = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies.token;
    
    if (!token) {
      // Development bypass: use first available user for testing
      const [user] = await db.select().from(users).limit(1);
      if (user) {
        const { password: _, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
        return next();
      }
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, decoded.id));
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token. User not found.' });
    }

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;
    req.user = userWithoutPassword;
    
    next();
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