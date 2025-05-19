import { config } from 'dotenv';
config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export const CONFIG = {
  DATABASE: {
    URL: process.env.DATABASE_URL as string,
    HOST: process.env.PGHOST,
    PORT: parseInt(process.env.PGPORT || '5432'),
    USER: process.env.PGUSER,
    PASSWORD: process.env.PGPASSWORD,
    NAME: process.env.PGDATABASE
  },
  JWT: {
    SECRET: process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production',
    EXPIRES_IN: '24h'
  },
  STRIPE: {
    SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    PUBLIC_KEY: process.env.VITE_STRIPE_PUBLIC_KEY || ''
  },
  OPENAI: {
    API_KEY: process.env.OPENAI_API_KEY || ''
  },
  FIREBASE: {
    PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || '',
    API_KEY: process.env.VITE_FIREBASE_API_KEY || ''
  },
  SERVER: {
    PORT: process.env.PORT || 8000,
    NODE_ENV: process.env.NODE_ENV || 'development'
  }
} as const;

// Validate required environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'OPENAI_API_KEY'
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
} 