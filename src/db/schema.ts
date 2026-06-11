import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const STOCK_UNITS = ["Piece", "Kilogram", "Pack", "Sack"] as const;
export type StockUnit = (typeof STOCK_UNITS)[number];

/** How supplier WS / retail prices are quoted on the pricelist. */
export const PRICE_UNITS = ["Sack", "Piece", "Case"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const DEFAULT_UNITS_PER_CASE = 24;

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  variant: text("variant"),
  packSize: text("pack_size"),
  /** Dog Dry Food, Cat Wet Food (Can), Toys, etc. */
  itemType: text("item_type"),
  stockUnit: text("stock_unit", { enum: STOCK_UNITS })
    .notNull()
    .default("Piece"),
  /** Tenths of kg per sack (e.g. 70 = 7.0 kg). Used when stocking/selling by sack. */
  kgPerSack: integer("kg_per_sack"),
  /** Cans/pouches per case (default 24). Used for case ↔ pcs stock display and sales. */
  unitsPerCase: integer("units_per_case").default(24),
  // Store money as integer cents to avoid floating point issues.
  costPrice: integer("cost_price").notNull(),
  retailPrice: integer("retail_price").notNull(),
  bulkPrice: integer("bulk_price").notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  expiryDate: integer("expiry_date", { mode: "timestamp" }),
  supplierId: integer("supplier_id"),
  supplierCatalogItemId: integer("supplier_catalog_item_id"),
  supplierRetailPrice: integer("supplier_retail_price"),
  supplierBulkPrice: integer("supplier_bulk_price"),
  purchaseTier: text("purchase_tier", { enum: ["Wholesale", "Retail"] })
    .notNull()
    .default("Wholesale"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contact: text("contact"),
  totalSpend: integer("total_spend").notNull().default(0),
  location: text("location"),
});

export const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Out for Delivery",
  "Completed",
  "Cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  contact: text("contact"),
  location: text("location"),
  notes: text("notes"),
  orderStatus: text("order_status", { enum: ORDER_STATUSES })
    .notNull()
    .default("Pending"),
  stockDeducted: integer("stock_deducted", { mode: "boolean" })
    .notNull()
    .default(false),
  /** Sum of line totals before order-level discount. */
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  discountCents: integer("discount_cents").notNull().default(0),
  discountType: text("discount_type", {
    enum: ["None", "Fixed", "Percent"],
  })
    .notNull()
    .default("None"),
  /** Fixed: centavos stored. Percent: whole percent (10 = 10%). */
  discountValue: integer("discount_value").notNull().default(0),
  discountNote: text("discount_note"),
  totalAmount: integer("total_amount").notNull(),
  amountPaid: integer("amount_paid").notNull().default(0),
  paymentStatus: text("payment_status", {
    enum: ["Pending", "30% Deposit", "Paid"],
  })
    .notNull()
    .default("Pending"),
  deliveryMethod: text("delivery_method"),
  storeType: text("store_type", { enum: ["Online", "Walk-in"] })
    .notNull()
    .default("Online"),
  /** User who recorded the sale (cashier on duty). */
  createdByUserId: integer("created_by_user_id"),
  /** Snapshot of cashier display name at sale time. */
  cashierName: text("cashier_name"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const SALE_UNITS = ["Piece", "Kilogram", "Pack", "Sack", "Case"] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  quantityTenths: integer("quantity_tenths"),
  saleUnit: text("sale_unit", { enum: SALE_UNITS })
    .notNull()
    .default("Piece"),
  priceTier: text("price_tier", { enum: ["Retail", "Bulk"] })
    .notNull()
    .default("Retail"),
  unitCost: integer("unit_cost").notNull().default(0),
  unitPrice: integer("unit_price").notNull(),
  lineTotal: integer("line_total").notNull(),
  isExcessSale: integer("is_excess_sale", { mode: "boolean" })
    .notNull()
    .default(false),
  lineNote: text("line_note"),
});

export const deliveryLogs = sqliteTable("delivery_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id"),
  customerName: text("customer_name"),
  location: text("location"),
  deliveryMethod: text("delivery_method", {
    enum: ["Montalban Free Delivery", "Lalamove", "Other"],
  }).notNull(),
  status: text("status", {
    enum: ["Queued", "Booked", "Picked Up", "Delivered", "Cancelled"],
  })
    .notNull()
    .default("Queued"),
  fee: integer("fee").notNull().default(0),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const deliveryStatusHistory = sqliteTable("delivery_status_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deliveryLogId: integer("delivery_log_id").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  note: text("note"),
  changedAt: integer("changed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const preOrders = sqliteTable("pre_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull(),
  status: text("status", {
    enum: ["Draft", "Ordered", "In Transit", "Partial", "Received", "Cancelled"],
  })
    .notNull()
    .default("Draft"),
  customerName: text("customer_name"),
  expectedDate: integer("expected_date", { mode: "timestamp" }),
  depositCents: integer("deposit_cents").notNull().default(0),
  totalCostCents: integer("total_cost_cents").notNull().default(0),
  notes: text("notes"),
  fulfillmentOrderId: integer("fulfillment_order_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const preOrderItems = sqliteTable("pre_order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  preOrderId: integer("pre_order_id").notNull(),
  productId: integer("product_id"),
  supplierCatalogItemId: integer("supplier_catalog_item_id"),
  itemName: text("item_name").notNull(),
  brand: text("brand"),
  variant: text("variant"),
  quantity: integer("quantity").notNull().default(0),
  unitCostCents: integer("unit_cost_cents").notNull().default(0),
  lineTotalCents: integer("line_total_cents").notNull().default(0),
  receivedQty: integer("received_qty").notNull().default(0),
});

export const transportPricingSettings = sqliteTable("transport_pricing_settings", {
  id: integer("id").primaryKey(),
  baseFeeCents: integer("base_fee_cents").notNull().default(15000),
  perKmCents: integer("per_km_cents").notNull().default(2500),
  minimumFeeCents: integer("minimum_fee_cents").notNull().default(15000),
  trafficPerMinCents: integer("traffic_per_min_cents").notNull().default(800),
  stopLightFeeCents: integer("stop_light_fee_cents").notNull().default(2000),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const transportExtras = sqliteTable("transport_extras", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transportJobId: integer("transport_job_id").notNull(),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
});

export const transportLocationLogs = sqliteTable("transport_location_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transportJobId: integer("transport_job_id").notNull(),
  lat: text("lat").notNull(),
  lng: text("lng").notNull(),
  recordedAt: integer("recorded_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const transportJobs = sqliteTable("transport_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerName: text("customer_name").notNull(),
  contact: text("contact"),
  pickupLocation: text("pickup_location").notNull(),
  dropoffLocation: text("dropoff_location").notNull(),
  pickupLat: text("pickup_lat"),
  pickupLng: text("pickup_lng"),
  dropoffLat: text("dropoff_lat"),
  dropoffLng: text("dropoff_lng"),
  petDetails: text("pet_details"),
  serviceType: text("service_type", {
    enum: ["Pet Taxi", "Vet Visit", "Grooming Visit", "Boarding Transfer", "Other"],
  })
    .notNull()
    .default("Pet Taxi"),
  status: text("status", {
    enum: ["Requested", "Scheduled", "In Transit", "Completed", "Cancelled"],
  })
    .notNull()
    .default("Requested"),
  fee: integer("fee").notNull().default(0),
  distanceKmTenths: integer("distance_km_tenths").notNull().default(0),
  baseFeeCents: integer("base_fee_cents").notNull().default(0),
  distanceFeeCents: integer("distance_fee_cents").notNull().default(0),
  trafficFeeCents: integer("traffic_fee_cents").notNull().default(0),
  stopLightFeeCents: integer("stop_light_fee_cents").notNull().default(0),
  extrasTotalCents: integer("extras_total_cents").notNull().default(0),
  trackingToken: text("tracking_token").unique(),
  driverLat: text("driver_lat"),
  driverLng: text("driver_lng"),
  lastLocationAt: integer("last_location_at", { mode: "timestamp" }),
  receiptNumber: text("receipt_number"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const stockMovements = sqliteTable("stock_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull(),
  movementType: text("movement_type", {
    enum: ["Sale", "Restock", "Adjustment", "Cancel"],
  }).notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  relatedOrderId: integer("related_order_id"),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  contact: text("contact"),
  location: text("location"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const supplierDocuments = sqliteTable("supplier_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const supplierCatalogItems = sqliteTable("supplier_catalog_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull(),
  documentId: integer("document_id"),
  itemName: text("item_name").notNull(),
  brand: text("brand"),
  productName: text("product_name"),
  variant: text("variant"),
  itemType: text("item_type"),
  sku: text("sku"),
  unitCost: integer("unit_cost"),
  packSize: text("pack_size"),
  packUnit: text("pack_unit"),
  perKiloPrice: integer("per_kilo_price"),
  retailPrice: integer("retail_price"),
  /** Sack, Piece, or Case — what WS / retail prices refer to on the supplier list. */
  priceUnit: text("price_unit", { enum: PRICE_UNITS }).default("Sack"),
  /** Units per case when priceUnit is Case or for canned/pouch inventory (default 24). */
  unitsPerCase: integer("units_per_case").default(24),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** One row per item per upload — full price timeline. */
export const supplierPriceHistory = sqliteTable("supplier_price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull(),
  documentId: integer("document_id").notNull(),
  itemKey: text("item_key").notNull(),
  itemName: text("item_name").notNull(),
  brand: text("brand"),
  variant: text("variant"),
  unitCost: integer("unit_cost"),
  retailPrice: integer("retail_price"),
  perKiloPrice: integer("per_kilo_price"),
  recordedAt: integer("recorded_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Price deltas detected when a supplier uploads a new list. */
export const supplierPriceChanges = sqliteTable("supplier_price_changes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  supplierId: integer("supplier_id").notNull(),
  itemKey: text("item_key").notNull(),
  itemName: text("item_name").notNull(),
  brand: text("brand"),
  variant: text("variant"),
  previousUnitCost: integer("previous_unit_cost"),
  newUnitCost: integer("new_unit_cost"),
  changePercent: integer("change_percent"),
  previousDocumentId: integer("previous_document_id"),
  newDocumentId: integer("new_document_id").notNull(),
  recordedAt: integer("recorded_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const USER_ROLES = ["admin", "cashier"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const investors = sqliteTable("investors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  contact: text("contact"),
  email: text("email"),
  address: text("address"),
  idReference: text("id_reference"),
  notes: text("notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const investorAgreements = sqliteTable("investor_agreements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  investorId: integer("investor_id").notNull(),
  /** Authorized signatory / agreement holder on behalf of the business. */
  agreementHolder: text("agreement_holder").notNull(),
  capitalCents: integer("capital_cents").notNull(),
  /** Whole percent, e.g. 10 = 10% of monthly net income. */
  sharePercent: integer("share_percent").notNull(),
  agreementDate: integer("agreement_date", { mode: "timestamp" }),
  effectiveFrom: integer("effective_from", { mode: "timestamp" }),
  termsNotes: text("terms_notes"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const investorPayouts = sqliteTable("investor_payouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  investorId: integer("investor_id").notNull(),
  agreementId: integer("agreement_id").notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  grossRevenueCents: integer("gross_revenue_cents").notNull(),
  cogsCents: integer("cogs_cents").notNull(),
  netIncomeCents: integer("net_income_cents").notNull(),
  sharePercent: integer("share_percent").notNull(),
  payoutCents: integer("payout_cents").notNull(),
  status: text("status", { enum: ["Accrued", "Paid"] })
    .notNull()
    .default("Accrued"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role", { enum: USER_ROLES }).notNull().default("cashier"),
  /** Hourly wage in centavos for payroll. */
  hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  clockInAt: integer("clock_in_at", { mode: "timestamp" }).notNull(),
  clockOutAt: integer("clock_out_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const payrollPayouts = sqliteTable("payroll_payouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  minutesWorked: integer("minutes_worked").notNull(),
  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  grossPayCents: integer("gross_pay_cents").notNull(),
  status: text("status", { enum: ["Accrued", "Paid"] })
    .notNull()
    .default("Accrued"),
  paidAt: integer("paid_at", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

