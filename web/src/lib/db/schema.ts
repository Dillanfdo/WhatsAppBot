import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Half-open timestamptz range. Drizzle has no native tstzrange type.
 * Inserts must use sql`tstzrange(${start}, ${end}, '[)')`.
 */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tstzrange";
  },
});

export type BusinessConfig = {
  tone?: string;
  languages?: string[];
  cancellation_window_hours?: number;
  min_notice_hours?: number;
  max_days_ahead?: number;
  auto_confirm?: boolean;
  max_active_bookings_per_customer?: number;
  /** 0 = Sunday ... 6 = Saturday. Missing means every weekday with store hours accepts bookings. */
  bookable_weekdays?: number[];
};

export type IntakeQuestion = {
  id?: string;
  key?: string;
  prompt?: string;
  label?: string;
  required?: boolean;
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

const createdAndUpdated = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    description: text("description"),
    address: text("address"),
    mapUrl: text("map_url"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    slotIntervalMin: integer("slot_interval_min").notNull().default(15),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    ownerWhatsapp: text("owner_whatsapp"),
    config: jsonb("config").$type<BusinessConfig>().notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    ...createdAndUpdated,
  },
  (table) => [
    check(
      "businesses_contact_phone_e164",
      sql`${table.contactPhone} is null or ${table.contactPhone} ~ '^[+][1-9][0-9]{1,14}$'`,
    ),
    check(
      "businesses_owner_whatsapp_e164",
      sql`${table.ownerWhatsapp} is null or ${table.ownerWhatsapp} ~ '^[+][1-9][0-9]{1,14}$'`,
    ),
  ],
);

export const businessDocuments = pgTable(
  "business_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    version: integer("version").notNull().default(1),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    unique("business_documents_business_type_version_unique").on(
      table.businessId,
      table.type,
      table.version,
    ),
    check(
      "business_documents_type_check",
      sql`${table.type} in ('privacy', 'terms', 'faq', 'cancellation', 'no_show', 'rules', 'price_list')`,
    ),
  ],
);

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("resources_business_id_idx").on(table.businessId),
    check(
      "resources_type_check",
      sql`${table.type} in ('staff', 'table', 'room', 'console', 'chair')`,
    ),
    check("resources_capacity_check", sql`${table.capacity} >= 1`),
  ],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMin: integer("duration_min").notNull(),
    bufferAfterMin: integer("buffer_after_min").notNull().default(0),
    priceCents: integer("price_cents"),
    currency: text("currency").notNull().default("INR"),
    minParty: integer("min_party").notNull().default(1),
    maxParty: integer("max_party").notNull().default(1),
    intakeQuestions: jsonb("intake_questions")
      .$type<IntakeQuestion[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("services_business_id_idx").on(table.businessId),
    check("services_duration_min_check", sql`${table.durationMin} > 0`),
    check("services_buffer_after_min_check", sql`${table.bufferAfterMin} >= 0`),
    check("services_party_check", sql`${table.maxParty} >= ${table.minParty}`),
  ],
);

export const serviceResourceRequirements = pgTable(
  "service_resource_requirements",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [
    primaryKey({
      columns: [table.serviceId, table.resourceType],
      name: "service_resource_requirements_pkey",
    }),
    check("service_resource_requirements_quantity_check", sql`${table.quantity} >= 1`),
    check(
      "service_resource_requirements_resource_type_check",
      sql`${table.resourceType} in ('staff', 'table', 'room', 'console', 'chair')`,
    ),
  ],
);

export const serviceResources = pgTable(
  "service_resources",
  {
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
  },
  (table) => [
    primaryKey({
      columns: [table.serviceId, table.resourceId],
      name: "service_resources_pkey",
    }),
  ],
);

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "restrict" }),
    /** 0 = Sunday ... 6 = Saturday. */
    weekday: smallint("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (table) => [
    index("availability_rules_business_id_idx").on(table.businessId),
    check("availability_rules_weekday_check", sql`${table.weekday} between 0 and 6`),
    check("availability_rules_time_order_check", sql`${table.endTime} > ${table.startTime}`),
  ],
);

export const availabilityExceptions = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    resourceId: uuid("resource_id").references(() => resources.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isOpen: boolean("is_open").notNull().default(false),
    reason: text("reason"),
  },
  (table) => [
    index("availability_exceptions_business_id_idx").on(table.businessId),
    check("availability_exceptions_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    phone: text("phone").notNull(),
    name: text("name"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("customers_business_id_phone_unique").on(table.businessId, table.phone),
    check("customers_phone_e164", sql`${table.phone} ~ '^[+][1-9][0-9]{1,14}$'`),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    partySize: integer("party_size").notNull().default(1),
    status: text("status").notNull().default("confirmed"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    answers: jsonb("answers").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    ...createdAndUpdated,
  },
  (table) => [
    unique("bookings_business_id_idempotency_key_unique").on(table.businessId, table.idempotencyKey),
    index("bookings_business_id_starts_at_idx").on(table.businessId, table.startsAt),
    index("bookings_customer_id_idx").on(table.customerId),
    check("bookings_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
    check("bookings_party_size_check", sql`${table.partySize} >= 1`),
    check(
      "bookings_status_check",
      sql`${table.status} in ('held', 'confirmed', 'cancelled', 'completed', 'no_show')`,
    ),
  ],
);

export const bookingResources = pgTable(
  "booking_resources",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "restrict" }),
    during: tstzrange("during").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    primaryKey({
      columns: [table.bookingId, table.resourceId],
      name: "booking_resources_pkey",
    }),
    index("booking_resources_resource_id_idx").on(table.resourceId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    channel: text("channel").notNull().default("web_test"),
    externalId: text("external_id").notNull(),
    status: text("status").notNull().default("active"),
    ...createdAndUpdated,
  },
  (table) => [
    index("conversations_business_id_external_id_idx").on(table.businessId, table.externalId),
    check(
      "conversations_status_check",
      sql`${table.status} in ('active', 'handoff', 'closed')`,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    providerMessageId: text("provider_message_id"),
    ...timestamps,
  },
  (table) => [
    unique("messages_conversation_id_provider_message_id_unique").on(
      table.conversationId,
      table.providerMessageId,
    ),
    index("messages_conversation_id_created_at_idx").on(table.conversationId, table.createdAt),
    check("messages_role_check", sql`${table.role} in ('user', 'assistant', 'tool')`),
  ],
);
