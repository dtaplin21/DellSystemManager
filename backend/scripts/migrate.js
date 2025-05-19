require('dotenv').config();
const { connectToDatabase, applyMigrations } = require('../db');

async function runMigrations() {
  try {
    await connectToDatabase();
    await applyMigrations();
    console.log('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations(); 