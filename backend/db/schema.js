const { pgTable, uuid, varchar, text, timestamp, integer, decimal, boolean, json, serial } = require('drizzle-orm/pg-core');

// Users table
const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password'),
  displayName: text('display_name'),
  company: text('company'),
  position: text('position'),
  subscription: varchar('subscription', { length: 20 }).default('basic'),
  profileImageUrl: text('profile_image_url'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Projects table (updated for Supabase)
const projects = pgTable('projects', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location'),
  status: varchar('status', { length: 20 }).default('active'),
  scale: decimal('scale').default('0.0025'),
  layoutWidth: integer('layout_width').default(10000),
  layoutHeight: integer('layout_height').default(15000),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Panel layouts table (matches actual database structure)
const panels = pgTable('panel_layouts', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  panels: text('panels').notNull(), // JSON string of panel data
  width: decimal('width').notNull(),
  height: decimal('height').notNull(),
  scale: decimal('scale').notNull().default('1'),
  lastUpdated: timestamp('last_updated').notNull(),
});

// Documents table
const documents = pgTable('documents', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  uploadedAt: timestamp('uploaded_at').notNull(),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
});

// QC Data table
const qcData = pgTable('qc_data', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  type: varchar('type', { length: 50 }).notNull(), // destructive, trial, repair, placement, seaming
  panelId: varchar('panel_id', { length: 255 }).notNull(),
  date: timestamp('date').notNull(),
  result: varchar('result', { length: 50 }).notNull(), // pass, fail, pending
  technician: varchar('technician', { length: 255 }),
  temperature: decimal('temperature'),
  pressure: decimal('pressure'),
  speed: decimal('speed'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Notifications table
const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // info, warning, error, success
  relatedTo: varchar('related_to', { length: 50 }), // project, qc_data, etc.
  relatedId: uuid('related_id'),
  read: boolean('read').default(false),
  date: timestamp('date').notNull(),
});

module.exports = {
  users,
  projects,
  panels,
  documents,
  qcData,
  notifications,
};
