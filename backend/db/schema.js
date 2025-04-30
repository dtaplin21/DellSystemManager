const { pgTable, uuid, varchar, text, timestamp, integer, decimal, boolean, json } = require('drizzle-orm/pg-core');

// Users table
const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),
  company: varchar('company', { length: 255 }),
  position: varchar('position', { length: 255 }),
  subscription: varchar('subscription', { length: 50 }).default('basic'),
  roles: json('roles'),
  profileImageUrl: text('profile_image_url'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at'),
});

// Projects table
const projects = pgTable('projects', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).notNull(),
  client: varchar('client', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  area: decimal('area'),
  progress: integer('progress').default(0),
  subscription: varchar('subscription', { length: 50 }).default('basic'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at'),
});

// Panel layouts table
const panels = pgTable('panels', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  panels: text('panels').notNull(), // JSON string of panels data
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
