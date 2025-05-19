import postgres from 'postgres';
import { CONFIG } from '../config';

if (!CONFIG.DATABASE.URL) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const sql = postgres(CONFIG.DATABASE.URL, {
  ssl: {
    rejectUnauthorized: false // Only for development, remove in production
  },
  max: 20,
  idle_timeout: 30,
  connect_timeout: 2
});

// Test the connection using async/await pattern
const testConnection = async () => {
  try {
    const result = await sql`SELECT NOW()`;
    console.log('Database connected successfully');
    return result;
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(-1);
  }
};

// Run the test
testConnection();

export default sql; 