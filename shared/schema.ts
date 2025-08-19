import { pgTable, uuid, text, timestamp, integer, decimal, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  displayName: text('display_name').notNull(),
  company: text('company'),
  position: text('position'),
  subscription: text('subscription').default('basic'),
  profileImageUrl: text('profile_image_url'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Projects table - Updated to match backend schema
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  client: varchar('client', { length: 255 }),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location'),
  status: varchar('status', { length: 20 }).default('active'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  area: decimal('area'),
  progress: integer('progress').default(0),
  scale: decimal('scale').default('1.0'),
  layoutWidth: integer('layout_width').default(10000),
  layoutHeight: integer('layout_height').default(15000),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Panel layouts table - Updated to match actual database structure
export const panelLayouts = pgTable('panel_layouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  panels: text('panels').notNull(), // JSON string of panel data (matches backend)
  width: decimal('width').notNull(), // Layout width in feet
  height: decimal('height').notNull(), // Layout height in feet
  scale: decimal('scale').notNull().default('1'), // Layout scale
  lastUpdated: timestamp('last_updated').notNull(), // Last update timestamp
});

// QC data table - Updated to match backend schema
export const qcData = pgTable('qc_data', {
  id: uuid('id').primaryKey().defaultRandom(),
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

// Documents table - Updated to match backend schema
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  size: integer('size').notNull(),
  path: text('path').notNull(),
  uploadedAt: timestamp('uploaded_at').notNull(),
  uploadedBy: varchar('uploaded_by', { length: 255 }).notNull(),
  textContent: text('text_content'), // Added for AI analysis
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  documents: many(documents),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  panelLayouts: many(panelLayouts),
  qcData: many(qcData),
  documents: many(documents),
}));

export const panelLayoutsRelations = relations(panelLayouts, ({ one }) => ({
  project: one(projects, {
    fields: [panelLayouts.projectId],
    references: [projects.id],
  }),
}));

export const qcDataRelations = relations(qcData, ({ one }) => ({
  project: one(projects, {
    fields: [qcData.projectId],
    references: [projects.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, {
    fields: [documents.projectId],
    references: [projects.id],
  }),
  uploadedBy: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
}));

// TypeScript types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type PanelLayout = typeof panelLayouts.$inferSelect;
export type InsertPanelLayout = typeof panelLayouts.$inferInsert;
export type QcData = typeof qcData.$inferSelect;
export type InsertQcData = typeof qcData.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// Additional type for parsed panel data
export interface ParsedPanelLayout extends Omit<PanelLayout, 'panels'> {
  panels: any[]; // Parsed JSON array instead of JSON string
} 