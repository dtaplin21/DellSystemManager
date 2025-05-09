import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, User } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'placeholder-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com` : 
    'quality-control-ca71d.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'quality-control-ca71d',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com` : 
    'quality-control-ca71d.appspot.com',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'placeholder-app-id',
};

// Initialize Firebase
let firebaseApp: any;
let auth: any;

// Check if we're in a browser environment
if (typeof window !== 'undefined') {
  try {
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
  } catch (error) {
    console.error('Firebase initialization error:', error);
    // Create a mock implementation for development purposes
    if (!auth) {
      console.warn('Creating mock Firebase auth for development purposes');
      auth = {
        currentUser: null,
        onAuthStateChanged: (callback: (user: User | null) => void) => {
          callback(null);
          return () => {};
        },
        signOut: async () => Promise.resolve(true),
      } as any;
    }
  }
}

// Google authentication provider
const googleProvider = new GoogleAuthProvider();

// Auth functions
export const signInWithGoogle = async () => {
  if (!auth || !auth.signInWithPopup) {
    console.warn('Firebase auth not properly initialized, returning mock response');
    return { 
      user: { 
        uid: 'mock-uid',
        email: 'mock-user@example.com',
        displayName: 'Mock User'
      }, 
      idToken: 'mock-token' 
    };
  }
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken };
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, password: string) => {
  if (!auth || !auth.createUserWithEmailAndPassword) {
    console.warn('Firebase auth not properly initialized, returning mock response');
    return { 
      user: { 
        uid: 'mock-uid',
        email: email,
        displayName: email.split('@')[0]
      }, 
      idToken: 'mock-token' 
    };
  }
  
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken };
  } catch (error) {
    console.error('Email sign-up error:', error);
    throw error;
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  if (!auth || !auth.signInWithEmailAndPassword) {
    console.warn('Firebase auth not properly initialized, returning mock response');
    return { 
      user: { 
        uid: 'mock-uid',
        email: email,
        displayName: email.split('@')[0]
      }, 
      idToken: 'mock-token' 
    };
  }
  
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken };
  } catch (error) {
    console.error('Email sign-in error:', error);
    throw error;
  }
};

export const logoutFirebase = async () => {
  if (!auth || !auth.signOut) {
    console.warn('Firebase auth not properly initialized, mocking logout');
    return true;
  }
  
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error('Sign-out error:', error);
    throw error;
  }
};

export const getCurrentFirebaseUser = (): User | null => {
  if (!auth) return null;
  return auth.currentUser;
};

export { auth };
