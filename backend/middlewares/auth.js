const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

// Middleware to authenticate JWT token
const auth = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in cookies first (more secure)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } 
    // Fall back to Authorization header
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.id));
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Remove password from user object
    const { password, ...userWithoutPassword } = user;
    
    // Attach user to request
    req.user = userWithoutPassword;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { auth };
