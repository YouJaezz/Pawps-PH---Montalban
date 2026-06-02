import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  variant: text("variant"),
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  priceTier: text("price_tier", { enum: ["Retail", "Bulk"] })
    .notNull()
    .default("Retail"),
  unitCost: integer("unit_cost").notNull().default(0),
  unitPrice: integer("unit_price").notNull(),
  lineTotal: integer("line_total").notNull(),
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
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const preOrderItems = sqliteTable("pre_order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  preOrderId: integer("pre_order_id").notNull(),
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

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

