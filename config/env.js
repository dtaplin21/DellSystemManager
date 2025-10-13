const path = require('path');
const { config: loadEnv } = require('dotenv');
const { z } = require('zod');

// Load environment variables only once so scripts that require this module get a configured process.env.
if (!process.env.__ENV_LOADED__) {
  loadEnv({ path: path.join(__dirname, '..', '.env') });
  process.env.__ENV_LOADED__ = 'true';
}

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z
      .string()
      .optional()
      .transform((value) => {
        if (!value) return undefined;
        const parsed = Number.parseInt(value, 10);
        if (Number.isNaN(parsed)) {
          throw new Error('PORT must be a valid number');
        }
        return parsed;
      }),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    SUPABASE_KEY: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    SUPABASE_JWT_SECRET: z.string().optional(),
    FRONTEND_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    VITE_FIREBASE_API_KEY: z.string().optional(),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional()
  })
  .passthrough()
  .superRefine((env, ctx) => {
    if (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'Either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY must be provided'
      });
    }
  });

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errorMessages = parsedEnv.error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
  throw new Error(`Invalid environment configuration:\n${errorMessages.join('\n')}`);
}

const env = parsedEnv.data;
const nodeEnv = env.NODE_ENV;
const isProduction = nodeEnv === 'production';

const configuration = {
  nodeEnv,
  isProduction,
  isDevelopment: nodeEnv === 'development',
  isTest: nodeEnv === 'test',
  port: env.PORT ?? 8003,
  cors: {
    origin: env.CORS_ORIGIN || env.FRONTEND_URL || 'http://localhost:3000'
  },
  databaseUrl: env.DATABASE_URL,
  supabase: {
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || null,
    anonKey: env.SUPABASE_KEY || null,
    jwtSecret: env.SUPABASE_JWT_SECRET || null
  },
  secrets: {
    jwt: env.JWT_SECRET || null,
    stripe: env.STRIPE_SECRET_KEY || null,
    openai: env.OPENAI_API_KEY || null,
    firebaseApiKey: env.VITE_FIREBASE_API_KEY || null
  },
  logging: {
    level: env.LOG_LEVEL || (isProduction ? 'info' : 'debug')
  },
  raw: env
};

module.exports = Object.freeze(configuration);
