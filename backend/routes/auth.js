const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { auth } = require('../middlewares/auth');
const { validateSignup, validateLogin } = require('../utils/validate');
const { db, supabase } = require('../db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

// Set token cookie
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
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
      console.log('Validation error:', validationError.details[0].message);
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
      console.error('Supabase signup error:', supabaseError);
      return res.status(400).json({ 
        message: supabaseError.message || 'Failed to create account',
        error: supabaseError
      });
    }
    
    if (!supabaseUser?.user) {
      console.error('No user returned from Supabase signup');
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
      console.error('Failed to sign in after signup:', signInError);
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
    console.log('Sending signup response:', { ...response, token: response.token ? '[REDACTED]' : undefined });
    res.status(201).json(response);
  } catch (error) {
    console.error('Signup error:', error);
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
    console.log('Login attempt for email:', email);
    
    // Validate input
    const { error: validationError } = validateLogin({ email, password });
    if (validationError) {
      console.log('Validation error:', validationError.details[0].message);
      return res.status(400).json({ message: validationError.details[0].message });
    }
    
    // Sign in with Supabase
    console.log('Attempting Supabase sign in...');
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (supabaseError) {
      console.error('Supabase auth error:', supabaseError);
      return res.status(401).json({ 
        message: supabaseError.message || 'Invalid credentials',
        error: supabaseError
      });
    }
    
    if (!supabaseUser?.user) {
      console.error('No user returned from Supabase');
      return res.status(401).json({ message: 'Authentication failed' });
    }
    
    console.log('Supabase auth successful, user ID:', supabaseUser.user.id);
    
    // Get user from our database
    const [user] = await db.select().from(users).where(eq(users.id, supabaseUser.user.id));
    
    if (!user) {
      console.error('User not found in database:', supabaseUser.user.id);
      return res.status(401).json({ message: 'User not found in database' });
    }
    
    console.log('User found in database:', user.id);
    
    // Set cookie
    setTokenCookie(res, supabaseUser.session.access_token);
    
    // Return user info and token
    const { password: _, ...userWithoutPassword } = user;
    const response = { 
      user: userWithoutPassword,
      token: supabaseUser.session.access_token 
    };
    console.log('Sending response:', { ...response, token: '[REDACTED]' });
    res.status(200).json(response);
  } catch (error) {
    console.error('Login error:', error);
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
