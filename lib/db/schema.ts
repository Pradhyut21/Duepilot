import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  date,
  timestamp,
  jsonb,
  numeric,
  unique,
  check,
} from 'drizzle-orm/pg-core';

const createdAtColumn = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull();

const updatedAtColumn = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: createdAtColumn(),
});

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    businessType: text('business_type').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    currency: text('currency').notNull().default('INR'),
    timeZone: text('time_zone').notNull().default('Asia/Kolkata'),
    openingBalancePaise: bigint('opening_balance_paise', { mode: 'number' })
      .notNull()
      .default(0),
    openingBalanceDate: date('opening_balance_date', { mode: 'string' }),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    check('businesses_opening_balance_nonneg', sql`${t.openingBalancePaise} >= 0`),
  ],
);

export const businessMemberships = pgTable(
  'business_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: createdAtColumn(),
  },
  (t) => [unique('business_memberships_business_user_unique').on(t.businessId, t.userId)],
);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  name: text('name').notNull(),
  eventDate: date('event_date', { mode: 'string' }),
  description: text('description'),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: createdAtColumn(),
});

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    projectId: uuid('project_id').references(() => projects.id),
    invoiceNumber: text('invoice_number').notNull(),
    issueDate: date('issue_date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    status: text('status').notNull().default('DRAFT'),
    subtotalPaise: integer('subtotal_paise').notNull().default(0),
    taxAmountPaise: integer('tax_amount_paise').notNull().default(0),
    totalPaise: integer('total_paise').notNull().default(0),
    currency: text('currency').notNull().default('INR'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    unique('invoices_business_number_unique').on(t.businessId, t.invoiceNumber),
    check(
      'invoices_status_check',
      sql`${t.status} in ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID')`,
    ),
    check('invoices_subtotal_nonneg', sql`${t.subtotalPaise} >= 0`),
    check('invoices_tax_nonneg', sql`${t.taxAmountPaise} >= 0`),
    check('invoices_total_nonneg', sql`${t.totalPaise} >= 0`),
    check('invoices_due_on_or_after_issue_check', sql`${t.dueDate} >= ${t.issueDate}`),
  ],
);

export const invoiceCounters = pgTable('invoice_counters', {
  businessId: uuid('business_id')
    .primaryKey()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  lastNumber: integer('last_number').notNull().default(0),
  updatedAt: updatedAtColumn(),
});

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 12, scale: 3 }).notNull(),
    unitPricePaise: integer('unit_price_paise').notNull(),
    taxRateBp: integer('tax_rate_bp'),
    lineTotalPaise: integer('line_total_paise').notNull(),
  },
  (t) => [
    check('invoice_items_quantity_positive', sql`${t.quantity} > 0`),
    check('invoice_items_unit_price_nonneg', sql`${t.unitPricePaise} >= 0`),
    check(
      'invoice_items_tax_rate_nonneg',
      sql`${t.taxRateBp} is null or ${t.taxRateBp} >= 0`,
    ),
    check('invoice_items_line_total_nonneg', sql`${t.lineTotalPaise} >= 0`),
  ],
);

export const paymentMilestones = pgTable(
  'payment_milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    expectedAmountPaise: integer('expected_amount_paise').notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    expectedPaymentDate: date('expected_payment_date', { mode: 'string' }),
  },
  (t) => [
    check(
      'payment_milestones_expected_amount_nonneg',
      sql`${t.expectedAmountPaise} >= 0`,
    ),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    amountPaise: integer('amount_paise').notNull(),
    receivedDate: date('received_date', { mode: 'string' }).notNull(),
    method: text('method').notNull(),
    reference: text('reference'),
    reversedAt: timestamp('reversed_at', { withTimezone: true, mode: 'date' }),
    idempotencyKey: text('idempotency_key'),
    createdAt: createdAtColumn(),
  },
  (t) => [
    unique('payments_business_idempotency_unique').on(t.businessId, t.idempotencyKey),
    check('payments_amount_positive', sql`${t.amountPaise} > 0`),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id),
    description: text('description').notNull(),
    category: text('category').notNull(),
    amountPaise: integer('amount_paise').notNull(),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    paidDate: date('paid_date', { mode: 'string' }),
    status: text('status').notNull().default('UNPAID'),
    recurrenceRule: text('recurrence_rule'),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (t) => [
    check('expenses_amount_positive', sql`${t.amountPaise} > 0`),
    check('expenses_status_check', sql`${t.status} in ('UNPAID', 'PAID')`),
  ],
);

export const paymentPromises = pgTable(
  'payment_promises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    promisedAmountPaise: integer('promised_amount_paise').notNull(),
    promisedDate: date('promised_date', { mode: 'string' }).notNull(),
    sourceNote: text('source_note'),
    confirmationStatus: text('confirmation_status').notNull(),
    createdAt: createdAtColumn(),
    supersededAt: timestamp('superseded_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => [check('payment_promises_amount_positive', sql`${t.promisedAmountPaise} > 0`)],
);

export const scenarios = pgTable('scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  assumptionsJson: jsonb('assumptions_json').$type<Record<string, unknown>>().notNull(),
  createdAt: createdAtColumn(),
});

export const reminderDrafts = pgTable('reminder_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull(),
  content: text('content').notNull(),
  approvalStatus: text('approval_status').notNull(),
  createdAt: createdAtColumn(),
});

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  beforeJson: jsonb('before_json').$type<Record<string, unknown>>(),
  afterJson: jsonb('after_json').$type<Record<string, unknown>>(),
  createdAt: createdAtColumn(),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  severity: text('severity').notNull(),
  relatedEntity: text('related_entity').notNull(),
  status: text('status').notNull(),
  explanation: text('explanation').notNull(),
  createdAt: createdAtColumn(),
});
