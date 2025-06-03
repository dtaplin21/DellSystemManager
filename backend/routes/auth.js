const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middlewares/auth');
const { validateSignup, validateLogin } = require('../utils/validate');
const { db } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized and if we have the required credentials
if (!admin.apps.length) {
  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin initialized successfully');
    } else {
      console.warn('Firebase credentials are missing. Google authentication will not be available.');
      // Create a mock Firebase admin for non-critical paths
      global.firebaseInitialized = false;
    }
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
    global.firebaseInitialized = false;
  }
} else {
  global.firebaseInitialized = true;
}

// JWT token generation
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, subscription: user.subscription },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Set cookie with token
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// User signup
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, company } = req.body;
    
    // Validate input
    const { error } = validateSignup({ name, email, password });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const [newUser] = await db.insert(users).values({
      id: uuidv4(),
      email,
      password: hashedPassword,
      displayName: name,
      company: company || null,
      subscription: 'basic', // Default subscription tier
      createdAt: new Date(),
    }).returning();
    
    // Generate JWT token
    const token = generateToken(newUser);
    
    // Set cookie
    setTokenCookie(res, token);
    
    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
});

// User login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    const { error } = validateLogin({ email, password });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set cookie
    setTokenCookie(res, token);
    
    // Return user info (without password)
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
});

// Google login
router.post('/google', async (req, res, next) => {
  try {
    // Check if Firebase is properly initialized
    if (!global.firebaseInitialized) {
      return res.status(503).json({ 
        message: 'Google authentication is not available. Please try email/password login instead.',
        reason: 'missing_firebase_credentials'
      });
    }

    const { idToken } = req.body;
    
    // Verify the token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, picture } = decodedToken;
    
    // Check if user exists
    let [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (!user) {
      // Create new user
      [user] = await db.insert(users).values({
        id: uuidv4(),
        email,
        displayName: name,
        profileImageUrl: picture,
        subscription: 'basic', // Default subscription tier
        createdAt: new Date(),
      }).returning();
    }
    
    // Generate JWT token
    const token = generateToken(user);
    
    // Set cookie
    setTokenCookie(res, token);
    
    // Return user info
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ 
      message: 'Authentication failed',
      reason: error.code || 'unknown_error'
    });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  // User is already attached to req by auth middleware
  res.status(200).json({ user: req.user });
});

// Update user profile
router.patch('/profile', auth, async (req, res, next) => {
  try {
    const { name, company, position } = req.body;
    const userId = req.user.id;
    
    const [updatedUser] = await db.update(users)
      .set({
        displayName: name || req.user.displayName,
        company: company !== undefined ? company : req.user.company,
        position: position !== undefined ? position : req.user.position,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    const { password: _, ...userWithoutPassword } = updatedUser;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
