// Define your database schema here
// Example:
import { pgTable, serial, text } from 'drizzle-orm/pg-core';

// Export your table definitions
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
}); 