const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middlewares/auth');
const { db, supabase } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');
const config = require('../config/env');
const logger = require('../lib/logger');

// Simple validation functions
const validateSignup = ({ name, email, password, company }) => {
  const errors = [];
  
  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!email || !email.includes('@')) {
    errors.push('Valid email is required');
  }
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  return { error: errors.length > 0 ? { details: [{ message: errors.join(', ') }] } : null };
};

const validateLogin = ({ email, password }) => {
  const errors = [];
  
  if (!email || !email.includes('@')) {
    errors.push('Valid email is required');
  }
  
  if (!password) {
    errors.push('Password is required');
  }
  
  return { error: errors.length > 0 ? { details: [{ message: errors.join(', ') }] } : null };
};

// Set token cookie
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    
    // Validate input
    const { error: validationError } = validateSignup({ name, email, password, company });
    if (validationError) {
      logger.debug('[AUTH:signup] Validation error', { message: validationError.details[0].message });
      return res.status(400).json({ message: validationError.details[0].message });
    }
    
    // Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Create user in Supabase
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (supabaseError) {
      logger.error('[AUTH:signup] Supabase signup error', {
        error: {
          message: supabaseError.message,
          details: supabaseError
        }
      });
      return res.status(400).json({ 
        message: supabaseError.message || 'Failed to create account',
        error: supabaseError
      });
    }
    
    if (!supabaseUser?.user) {
      logger.error('[AUTH:signup] No user returned from Supabase signup');
      return res.status(400).json({ message: 'Failed to create account' });
    }

    // Create user in our database
    const [user] = await db.insert(users).values({
      id: supabaseUser.user.id,
      email,
      displayName: name,
      company,
      subscription: 'basic',
      createdAt: new Date(),
    }).returning();

    // Sign in the user to get a session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      logger.warn('[AUTH:signup] Failed to sign in after signup', {
        error: {
          message: signInError.message
        }
      });
      // Still return success but without session
      return res.status(201).json({ 
        user: user,
        message: 'Account created successfully. Please check your email to verify your account.'
      });
    }

    // Set cookie if we have a session
    if (signInData?.session?.access_token) {
      setTokenCookie(res, signInData.session.access_token);
    }
    
    // Return user info and token if available
    const { password: _, ...userWithoutPassword } = user;
    const response = { 
      user: userWithoutPassword,
      token: signInData?.session?.access_token,
      message: 'Account created successfully'
    };
    logger.debug('[AUTH:signup] Signup successful', {
      userId: userWithoutPassword.id,
      tokenIssued: Boolean(response.token)
    });
    res.status(201).json(response);
  } catch (error) {
    logger.error('[AUTH:signup] Unexpected error', {
      error: {
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    res.status(500).json({ 
      message: error.message || 'An unexpected error occurred during signup',
      error: error.toString()
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    logger.debug('[AUTH:login] Login attempt', { email });
    
    // Validate input
    const { error: validationError } = validateLogin({ email, password });
    if (validationError) {
      logger.debug('[AUTH:login] Validation error', { message: validationError.details[0].message });
      return res.status(400).json({ message: validationError.details[0].message });
    }
    
    // Sign in with Supabase
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (supabaseError) {
      logger.warn('[AUTH:login] Supabase auth error', {
        error: {
          message: supabaseError.message
        }
      });
      return res.status(401).json({ 
        message: supabaseError.message || 'Invalid credentials',
        error: supabaseError
      });
    }
    
    if (!supabaseUser?.user) {
      logger.warn('[AUTH:login] No user returned from Supabase', { email });
      return res.status(401).json({ message: 'Authentication failed' });
    }
    
    logger.debug('[AUTH:login] Supabase auth successful', { userId: supabaseUser.user.id });
    
    // Get user from our database
    const [user] = await db.select().from(users).where(eq(users.id, supabaseUser.user.id));
    
    if (!user) {
      logger.warn('[AUTH:login] User not found in database', { userId: supabaseUser.user.id });
      return res.status(401).json({ message: 'User not found in database' });
    }
    
    logger.debug('[AUTH:login] User record found', { userId: user.id });
    
    // Set cookie
    setTokenCookie(res, supabaseUser.session.access_token);
    
    // Return user info and token
    const { password: _, ...userWithoutPassword } = user;
    const response = { 
      user: userWithoutPassword,
      token: supabaseUser.session.access_token 
    };
    logger.debug('[AUTH:login] Login successful', {
      userId: user.id,
      tokenIssued: Boolean(response.token)
    });
    res.status(200).json(response);
  } catch (error) {
    logger.error('[AUTH:login] Unexpected error', {
      error: {
        message: error.message,
        stack: config.isDevelopment ? error.stack : undefined
      }
    });
    res.status(500).json({ 
      message: error.message || 'An unexpected error occurred during login',
      error: error.toString()
    });
  }
});

// Google login
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    // Sign in with Google using Supabase
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });
    
    if (supabaseError) {
      return res.status(401).json({ 
        message: 'Google authentication failed',
        reason: supabaseError.message
      });
    }
    
    // Check if user exists in our database
    let [user] = await db.select().from(users).where(eq(users.email, supabaseUser.user.email));
    
    if (!user) {
      // Create new user
      [user] = await db.insert(users).values({
        id: supabaseUser.user.id,
        email: supabaseUser.user.email,
        displayName: supabaseUser.user.user_metadata.full_name,
        profileImageUrl: supabaseUser.user.user_metadata.avatar_url,
        subscription: 'basic',
        createdAt: new Date(),
      }).returning();
    }
    
    // Set cookie
    setTokenCookie(res, supabaseUser.session.access_token);
    
    // Return user info
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(401).json({ 
      message: 'Authentication failed',
      reason: error.message
    });
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
    
    // Clear cookie
    res.clearCookie('token');
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Failed to logout' });
  }
});

// Get current user
router.get('/user', auth, async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.status(200).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
});

module.exports = router;
