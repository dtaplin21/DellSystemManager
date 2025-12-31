const { pgTable, uuid, varchar, text, timestamp, integer, decimal, boolean, json, serial, jsonb, pgEnum } = require('drizzle-orm/pg-core');

// Cardinal direction enum type
const cardinalDirectionEnum = pgEnum('cardinal_direction', ['north', 'south', 'east', 'west']);

// Transform method enum type
const transformMethodEnum = pgEnum('transform_method', ['anchor_points', 'boundary_fit', 'manual']);

// Operation risk level enum type
const operationRiskLevelEnum = pgEnum('operation_risk_level', ['low', 'medium', 'high', 'critical']);

// Operation status enum type
const operationStatusEnum = pgEnum('operation_status', ['pending', 'approved', 'rejected', 'applied', 'rolled_back']);


// Users table
const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password'),
  displayName: text('display_name'),
  company: text('company'),
  position: text('position'),
  subscription: varchar('subscription', { length: 20 }).default('basic'),
  isAdmin: boolean('is_admin').default(false),
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
  client: varchar('client', { length: 255 }),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location'),
  status: varchar('status', { length: 20 }).default('active'),
  startDate: timestamp('start_date'),       // ← new
  endDate: timestamp('end_date'),         // ← new
  area: decimal('area'),               // ← new
  progress: integer('progress').default(0),           // ← new
  scale: decimal('scale').default('1.0'), // Consistent with panel layouts default
  layoutWidth: integer('layout_width').default(15000),
  layoutHeight: integer('layout_height').default(15000),
  cardinalDirection: cardinalDirectionEnum('cardinal_direction').default('north'), // Cardinal direction: north, south, east, west
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Panel layouts table (matches actual database structure)
const panelLayouts = pgTable('panel_layouts', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  panels: jsonb('panels').notNull().default('[]'), // JSON data for better performance and validation
  patches: jsonb('patches').notNull().default('[]'), // Patches (circles) - separate from panels
  destructiveTests: jsonb('destructive_tests').notNull().default('[]'), // Destructive tests (rectangles)
  width: decimal('width').notNull().default('4000'),
  height: decimal('height').notNull().default('4000'),
  scale: decimal('scale').notNull().default('1.0'),
  cardinalDirection: cardinalDirectionEnum('cardinal_direction'), // Cardinal direction: north, south, east, west (inherits from project)
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
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
  textContent: text('text_content'), // Added for AI analysis
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

const panelLayoutRequirements = pgTable('panel_layout_requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  panelSpecifications: jsonb('panel_specifications'),
  materialRequirements: jsonb('material_requirements'),
  rollInventory: jsonb('roll_inventory'),
  installationNotes: jsonb('installation_notes'),
  siteDimensions: jsonb('site_dimensions'),
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 2 }),
  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// User settings table
const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  autoCreateFromForms: boolean('auto_create_from_forms').default(true),
  autoCreateProjectIds: jsonb('auto_create_project_ids').default('[]'),
  automationTriggerTiming: varchar('automation_trigger_timing', { length: 20 }).default('approval'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Plan Geometry Model table
const planGeometryModels = pgTable('plan_geometry_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
  siteBoundary: jsonb('site_boundary').notNull(),
  referencePoints: jsonb('reference_points').default('[]'),
  siteWidth: decimal('site_width').notNull(),
  siteHeight: decimal('site_height').notNull(),
  units: varchar('units', { length: 20 }).default('feet'),
  scaleFactor: decimal('scale_factor'),
  noGoZones: jsonb('no_go_zones').default('[]'),
  keyFeatures: jsonb('key_features').default('[]'),
  panelMapRequirements: jsonb('panel_map_requirements').default('{}'),
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 2 }),
  extractionMethod: varchar('extraction_method', { length: 50 }),
  extractedAt: timestamp('extracted_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Layout Registration Transforms table
const layoutTransforms = pgTable('layout_transforms', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  planGeometryModelId: uuid('plan_geometry_model_id').notNull().references(() => planGeometryModels.id, { onDelete: 'cascade' }),
  translationX: decimal('translation_x').default('0'),
  translationY: decimal('translation_y').default('0'),
  rotationDegrees: decimal('rotation_degrees').default('0'),
  scaleX: decimal('scale_x').default('1'),
  scaleY: decimal('scale_y').default('1'),
  skewX: decimal('skew_x').default('0'),
  skewY: decimal('skew_y').default('0'),
  method: transformMethodEnum('method').notNull(),
  anchorPoints: jsonb('anchor_points').default('[]'),
  confidenceScore: decimal('confidence_score', { precision: 5, scale: 2 }),
  residualError: decimal('residual_error'),
  maxError: decimal('max_error'),
  scaleDeltaPercent: decimal('scale_delta_percent'),
  isUniformScale: boolean('is_uniform_scale').default(true),
  tolerancePass: boolean('tolerance_pass').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  appliedAt: timestamp('applied_at'),
});

// Compliance Operations table
const complianceOperations = pgTable('compliance_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  operationType: varchar('operation_type', { length: 50 }).notNull(),
  operationData: jsonb('operation_data').notNull(),
  riskLevel: operationRiskLevelEnum('risk_level').notNull(),
  status: operationStatusEnum('status').default('pending'),
  requiresApproval: boolean('requires_approval').default(true),
  changePlan: jsonb('change_plan'),
  executionResult: jsonb('execution_result'),
  beforeSnapshot: jsonb('before_snapshot'),
  afterSnapshot: jsonb('after_snapshot'),
  proposedBy: uuid('proposed_by').references(() => users.id),
  proposedAt: timestamp('proposed_at').defaultNow(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectedBy: uuid('rejected_by').references(() => users.id),
  rejectedAt: timestamp('rejected_at'),
  rejectionReason: text('rejection_reason'),
  rolledBackAt: timestamp('rolled_back_at'),
  rolledBackBy: uuid('rolled_back_by').references(() => users.id),
  rollbackReason: text('rollback_reason'),
  evidenceReferences: jsonb('evidence_references').default('[]'),
  agentRunId: uuid('agent_run_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Compliance Validations table
const complianceValidations = pgTable('compliance_validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  planGeometryModelId: uuid('plan_geometry_model_id').references(() => planGeometryModels.id, { onDelete: 'set null' }),
  layoutTransformId: uuid('layout_transform_id').references(() => layoutTransforms.id, { onDelete: 'set null' }),
  validationType: varchar('validation_type', { length: 50 }).notNull(),
  passed: boolean('passed').notNull(),
  complianceScore: decimal('compliance_score', { precision: 5, scale: 2 }),
  issues: jsonb('issues').default('[]'),
  warnings: jsonb('warnings').default('[]'),
  recommendations: jsonb('recommendations').default('[]'),
  scaleDeltaPercent: decimal('scale_delta_percent'),
  boundaryViolationsCount: integer('boundary_violations_count').default(0),
  shapeMismatchesCount: integer('shape_mismatches_count').default(0),
  validatedAt: timestamp('validated_at').defaultNow(),
  validatedBy: uuid('validated_by').references(() => users.id),
});


module.exports = {
  users,
  projects,
  panelLayouts,
  documents,
  qcData,
  notifications,
  panelLayoutRequirements,
  userSettings,
  planGeometryModels,
  layoutTransforms,
  complianceOperations,
  complianceValidations,
};
