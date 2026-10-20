import { relations } from 'drizzle-orm';
import {
  boolean, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';

const id = () => text('id').primaryKey().$defaultFn(() => crypto.randomUUID());
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const orgType = pgEnum('org_type', ['RETAILER', 'VENDOR']);
export const userStatus = pgEnum('user_status', ['ACTIVE', 'DEACTIVATED']);
export const vendorStatus = pgEnum('vendor_status', ['ACTIVE', 'ARCHIVED']);
export const settlement = pgEnum('settlement', ['INVOICE', 'DEDUCTION']);
export const eventStatus = pgEnum('event_status', ['PLANNING', 'LOCKED', 'COMPLETED']);
export const dealStatus = pgEnum('deal_status', ['DRAFT', 'SUBMITTED', 'SENT_BACK', 'APPROVED', 'REJECTED', 'WITHDRAWN']);
export const requestStatus = pgEnum('request_status', ['OPEN', 'ANSWERED', 'DECLINED']);

export const roles = pgTable('roles', {
  id: id(),
  name: text('name').notNull().unique(),
  org: orgType('org').notNull(),
  permissions: text('permissions').array().notNull().default([]),
  requireMfa: boolean('require_mfa').notNull().default(false),
  system: boolean('system').notNull().default(false),
  createdAt: created(),
});

export const vendors = pgTable('vendors', {
  id: id(),
  number: text('number').notNull().unique(),
  name: text('name').notNull(),
  broker: text('broker'),
  category: text('category').notNull(),
  settlement: settlement('settlement').notNull().default('INVOICE'),
  complianceScore: doublePrecision('compliance_score').notNull().default(0.9),
  status: vendorStatus('status').notNull().default('ACTIVE'),
  createdAt: created(),
});

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  roleId: text('role_id').notNull().references(() => roles.id),
  vendorId: text('vendor_id').references(() => vendors.id),
  categories: text('categories').array().notNull().default([]),
  status: userStatus('status').notNull().default('ACTIVE'),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  /** Shared demo account (or a user created by one). Demo accounts skip MFA and can only manage other demo accounts. */
  demo: boolean('demo').notNull().default(false),
  /** Walkthrough steps count actions taken after this time (set when the guide is restarted or the demo is reset). */
  guideStartedAt: timestamp('guide_started_at', { withTimezone: true }),
  createdAt: created(),
}, t => [index('users_vendor_idx').on(t.vendorId)]);

export const guideProgress = pgTable('guide_progress', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stepKey: text('step_key').notNull(),
  doneAt: timestamp('done_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.stepKey] })]);

export const sessions = pgTable('sessions', {
  id: id(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mfaPassed: boolean('mfa_passed').notNull().default(false),
  createdAt: created(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
}, t => [index('sessions_user_idx').on(t.userId)]);

export const items = pgTable('items', {
  upc: text('upc').primaryKey(),
  description: text('description').notNull(),
  size: text('size'),
  uom: text('uom'),
  orderCode: text('order_code'),
  casePack: integer('case_pack').notNull(),
  caseCost: doublePrecision('case_cost').notNull(),
  regularRetail: doublePrecision('regular_retail').notNull(),
  baseWeeklyUnits: integer('base_weekly_units').notNull().default(100),
  category: text('category'),
  vendorId: text('vendor_id').references(() => vendors.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('items_vendor_idx').on(t.vendorId)]);

export const events = pgTable('events', {
  id: id(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  quarter: text('quarter').notNull(),
  theme: text('theme'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  vehicles: text('vehicles').array().notNull().default([]),
  mediaBudget: doublePrecision('media_budget').notNull().default(0),
  fundingTarget: doublePrecision('funding_target').notNull().default(0),
  status: eventStatus('status').notNull().default('PLANNING'),
  createdAt: created(),
});

export type CaisspHeader = {
  vendorNumber?: string; broker?: string; salesperson?: string; phone?: string; email?: string; datePresented?: string;
  promotion?: string; adRunDates?: string; aimContract?: string; billingCompany?: string; billingContact?: string;
  billingEmail?: string; feature?: string; notes?: string;
};
export type AllowancePeriods = Partial<Record<'amap' | 'tpr' | 'ad' | 'bb' | 'wscan' | 'rscan', { start: string; end: string }>>;

export const deals = pgTable('deals', {
  id: id(),
  number: text('number').notNull().unique(),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  eventId: text('event_id').notNull().references(() => events.id),
  status: dealStatus('status').notNull().default('DRAFT'),
  version: integer('version').notNull().default(1),
  title: text('title').notNull(),
  header: jsonb('header').$type<CaisspHeader>().notNull().default({}),
  periods: jsonb('periods').$type<AllowancePeriods>().notNull().default({}),
  storeGroups: text('store_groups').array().notNull().default([]),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  adFee: doublePrecision('ad_fee').notNull().default(0),
  accrualPct: doublePrecision('accrual_pct').notNull().default(0),
  forecastUnits: integer('forecast_units'),
  signer: text('signer'),
  imported: boolean('imported').notNull().default(false),
  createdById: text('created_by_id'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedById: text('decided_by_id'),
  decidedByName: text('decided_by_name'),
  decisionNote: text('decision_note'),
  autoApproved: boolean('auto_approved').notNull().default(false),
  counterRate: doublePrecision('counter_rate'),
  ruleVersion: integer('rule_version'),
  createdAt: created(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('deals_vendor_idx').on(t.vendorId), index('deals_event_idx').on(t.eventId), index('deals_status_idx').on(t.status)]);

export const dealLines = pgTable('deal_lines', {
  id: id(),
  dealId: text('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  upc: text('upc').notNull(),
  description: text('description').notNull(),
  casePack: integer('case_pack').notNull(),
  caseCost: doublePrecision('case_cost').notNull(),
  regularRetail: doublePrecision('regular_retail').notNull(),
  baseWeeklyUnits: integer('base_weekly_units').notNull(),
  cmap: doublePrecision('cmap').notNull().default(0),
  tpr: doublePrecision('tpr').notNull().default(0),
  ad: doublePrecision('ad').notNull().default(0),
  billBack: doublePrecision('bill_back').notNull().default(0),
  wholesalerScan: doublePrecision('wholesaler_scan').notNull().default(0),
  retailerScan: doublePrecision('retailer_scan').notNull().default(0),
  zone3Retail: doublePrecision('zone3_retail'),
  zone4Retail: doublePrecision('zone4_retail'),
  zone5Retail: doublePrecision('zone5_retail'),
  loyaltyMulti: text('loyalty_multi'),
  sort: integer('sort').notNull().default(0),
}, t => [index('deal_lines_deal_idx').on(t.dealId), index('deal_lines_upc_idx').on(t.upc)]);

export const promotions = pgTable('promotions', {
  id: id(),
  number: text('number').notNull().unique(),
  name: text('name').notNull(),
  reason: text('reason').notNull(),
  eventId: text('event_id').notNull().references(() => events.id),
  brandVendorId: text('brand_vendor_id').references(() => vendors.id),
  createdById: text('created_by_id'),
  fundingRequested: boolean('funding_requested').notNull().default(false),
  createdAt: created(),
});

export const promotionLines = pgTable('promotion_lines', {
  id: id(),
  promotionId: text('promotion_id').notNull().references(() => promotions.id, { onDelete: 'cascade' }),
  upc: text('upc').notNull(),
  description: text('description').notNull(),
  unitCost: doublePrecision('unit_cost').notNull(),
  regularRetail: doublePrecision('regular_retail').notNull(),
  promoRetail: doublePrecision('promo_retail').notNull(),
  baseWeeklyUnits: integer('base_weekly_units').notNull(),
}, t => [index('promotion_lines_upc_idx').on(t.upc)]);

export const comments = pgTable('comments', {
  id: id(),
  dealId: text('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  internal: boolean('internal').notNull().default(false),
  createdAt: created(),
}, t => [index('comments_deal_idx').on(t.dealId)]);

export const fundingRequests = pgTable('funding_requests', {
  id: id(),
  vendorId: text('vendor_id').notNull().references(() => vendors.id),
  eventId: text('event_id').notNull().references(() => events.id),
  promotionId: text('promotion_id'),
  text: text('text').notNull(),
  status: requestStatus('status').notNull().default('OPEN'),
  dealId: text('deal_id'),
  createdById: text('created_by_id'),
  createdAt: created(),
});

export type RuleValues = {
  minGM: number; minCov: number; minLift: number; minInc: number; minScore: number;
  maxAuto: number; maxOpt: number; fullFund: number; autoApprove: boolean; cutoffDays: number; reviewDays: number;
  /** Days after an accrual deal ends that its earned balance can still be billed. */
  claimDays: number;
};
export const ruleSets = pgTable('rule_sets', {
  version: serial('version').primaryKey(),
  values: jsonb('values').$type<RuleValues>().notNull(),
  createdBy: text('created_by'),
  createdAt: created(),
});

export const counters = pgTable('counters', {
  name: text('name').primaryKey(),
  value: integer('value').notNull().default(0),
});

export const auditLog = pgTable('audit_log', {
  seq: serial('seq').primaryKey(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  actorId: text('actor_id'),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  objectType: text('object_type').notNull(),
  objectId: text('object_id').notNull(),
  detail: text('detail').notNull(),
  ip: text('ip'),
  prevHash: text('prev_hash').notNull(),
  hash: text('hash').notNull(),
}, t => [index('audit_object_idx').on(t.objectType, t.objectId), uniqueIndex('audit_hash_idx').on(t.hash)]);

/* ---------- actuals, accruals and billing ---------- */

/** One row per CSV file loaded (sales, receipts, Bill Back Manager). */
export const dataUploads = pgTable('data_uploads', {
  id: id(),
  kind: text('kind').notNull(), // SALES | RECEIPTS | BILLING
  fileName: text('file_name').notNull(),
  rows: integer('rows').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  notes: text('notes'),
  byName: text('by_name').notNull(),
  createdAt: created(),
});

/** POS / scan sales by UPC and week (week starts Monday). Re-uploading a UPC-week replaces it. */
export const salesActuals = pgTable('sales_actuals', {
  upc: text('upc').notNull(),
  weekStart: date('week_start').notNull(),
  units: doublePrecision('units').notNull(),
  sales: doublePrecision('sales'),
  uploadId: text('upload_id'),
}, t => [primaryKey({ columns: [t.upc, t.weekStart] }), index('sales_week_idx').on(t.weekStart)]);

/** Purchases received (cases and cost) by UPC and week. Drives accrual earnings. */
export const receipts = pgTable('receipts', {
  upc: text('upc').notNull(),
  weekStart: date('week_start').notNull(),
  cases: doublePrecision('cases').notNull(),
  cost: doublePrecision('cost').notNull(),
  uploadId: text('upload_id'),
}, t => [primaryKey({ columns: [t.upc, t.weekStart] }), index('receipts_week_idx').on(t.weekStart)]);

/** Bills and deductions as recorded in Bill Back Manager, imported by invoice/claim number. */
export const billingRecords = pgTable('billing_records', {
  id: id(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  dealNumber: text('deal_number').notNull(),
  vendorNumber: text('vendor_number'),
  invoiceDate: date('invoice_date'),
  method: text('method'),            // invoice | deduction
  billed: doublePrecision('billed').notNull().default(0),
  collected: doublePrecision('collected').notNull().default(0),
  status: text('status').notNull().default('OPEN'), // OPEN | PAID | DEDUCTED | PARTIAL | DISPUTED | WRITTEN_OFF
  uploadId: text('upload_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('billing_deal_idx').on(t.dealNumber)]);

export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  vendor: one(vendors, { fields: [users.vendorId], references: [vendors.id] }),
}));
export const dealsRelations = relations(deals, ({ one, many }) => ({
  vendor: one(vendors, { fields: [deals.vendorId], references: [vendors.id] }),
  event: one(events, { fields: [deals.eventId], references: [events.id] }),
  lines: many(dealLines),
  comments: many(comments),
}));
export const dealLinesRelations = relations(dealLines, ({ one }) => ({ deal: one(deals, { fields: [dealLines.dealId], references: [deals.id] }) }));
export const commentsRelations = relations(comments, ({ one }) => ({ deal: one(deals, { fields: [comments.dealId], references: [deals.id] }) }));
export const promotionsRelations = relations(promotions, ({ one, many }) => ({
  event: one(events, { fields: [promotions.eventId], references: [events.id] }),
  brandVendor: one(vendors, { fields: [promotions.brandVendorId], references: [vendors.id] }),
  lines: many(promotionLines),
}));
export const promotionLinesRelations = relations(promotionLines, ({ one }) => ({ promotion: one(promotions, { fields: [promotionLines.promotionId], references: [promotions.id] }) }));
export const vendorsRelations = relations(vendors, ({ many }) => ({ users: many(users), items: many(items), deals: many(deals) }));
export const eventsRelations = relations(events, ({ many }) => ({ deals: many(deals), promotions: many(promotions) }));
export const rolesRelations = relations(roles, ({ many }) => ({ users: many(users) }));
export const itemsRelations = relations(items, ({ one }) => ({ vendor: one(vendors, { fields: [items.vendorId], references: [vendors.id] }) }));
