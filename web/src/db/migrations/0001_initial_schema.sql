CREATE TABLE "availability_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"resource_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"reason" text,
	CONSTRAINT "availability_exceptions_time_order_check" CHECK ("availability_exceptions"."ends_at" > "availability_exceptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"resource_id" uuid,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	CONSTRAINT "availability_rules_weekday_check" CHECK ("availability_rules"."weekday" between 0 and 6),
	CONSTRAINT "availability_rules_time_order_check" CHECK ("availability_rules"."end_time" > "availability_rules"."start_time")
);
--> statement-breakpoint
CREATE TABLE "booking_resources" (
	"booking_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"during" "tstzrange" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "booking_resources_pkey" PRIMARY KEY("booking_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"answers" jsonb,
	"idempotency_key" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_business_id_idempotency_key_unique" UNIQUE("business_id","idempotency_key"),
	CONSTRAINT "bookings_time_order_check" CHECK ("bookings"."ends_at" > "bookings"."starts_at"),
	CONSTRAINT "bookings_party_size_check" CHECK ("bookings"."party_size" >= 1),
	CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" in ('held', 'confirmed', 'cancelled', 'completed', 'no_show'))
);
--> statement-breakpoint
CREATE TABLE "business_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_documents_business_type_version_unique" UNIQUE("business_id","type","version"),
	CONSTRAINT "business_documents_type_check" CHECK ("business_documents"."type" in ('privacy', 'terms', 'faq', 'cancellation', 'no_show', 'rules', 'price_list'))
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"address" text,
	"map_url" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"slot_interval_min" integer DEFAULT 15 NOT NULL,
	"contact_phone" text,
	"contact_email" text,
	"owner_whatsapp" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_contact_phone_e164" CHECK ("businesses"."contact_phone" is null or "businesses"."contact_phone" ~ '^[+][1-9][0-9]{1,14}$'),
	CONSTRAINT "businesses_owner_whatsapp_e164" CHECK ("businesses"."owner_whatsapp" is null or "businesses"."owner_whatsapp" ~ '^[+][1-9][0-9]{1,14}$')
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"customer_id" uuid,
	"channel" text DEFAULT 'web_test' NOT NULL,
	"external_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_status_check" CHECK ("conversations"."status" in ('active', 'handoff', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_business_id_phone_unique" UNIQUE("business_id","phone"),
	CONSTRAINT "customers_phone_e164" CHECK ("customers"."phone" ~ '^[+][1-9][0-9]{1,14}$')
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"provider_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_conversation_id_provider_message_id_unique" UNIQUE("conversation_id","provider_message_id"),
	CONSTRAINT "messages_role_check" CHECK ("messages"."role" in ('user', 'assistant', 'tool'))
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resources_type_check" CHECK ("resources"."type" in ('staff', 'table', 'room', 'console', 'chair')),
	CONSTRAINT "resources_capacity_check" CHECK ("resources"."capacity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "service_resource_requirements" (
	"service_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "service_resource_requirements_pkey" PRIMARY KEY("service_id","resource_type"),
	CONSTRAINT "service_resource_requirements_quantity_check" CHECK ("service_resource_requirements"."quantity" >= 1),
	CONSTRAINT "service_resource_requirements_resource_type_check" CHECK ("service_resource_requirements"."resource_type" in ('staff', 'table', 'room', 'console', 'chair'))
);
--> statement-breakpoint
CREATE TABLE "service_resources" (
	"service_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "service_resources_pkey" PRIMARY KEY("service_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_min" integer NOT NULL,
	"buffer_after_min" integer DEFAULT 0 NOT NULL,
	"price_cents" integer,
	"currency" text DEFAULT 'INR' NOT NULL,
	"min_party" integer DEFAULT 1 NOT NULL,
	"max_party" integer DEFAULT 1 NOT NULL,
	"intake_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_duration_min_check" CHECK ("services"."duration_min" > 0),
	CONSTRAINT "services_buffer_after_min_check" CHECK ("services"."buffer_after_min" >= 0),
	CONSTRAINT "services_party_check" CHECK ("services"."max_party" >= "services"."min_party")
);
--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_resources" ADD CONSTRAINT "booking_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_documents" ADD CONSTRAINT "business_documents_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resource_requirements" ADD CONSTRAINT "service_resource_requirements_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_resources" ADD CONSTRAINT "service_resources_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_exceptions_business_id_idx" ON "availability_exceptions" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "availability_rules_business_id_idx" ON "availability_rules" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "booking_resources_resource_id_idx" ON "booking_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "bookings_business_id_starts_at_idx" ON "bookings" USING btree ("business_id","starts_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_id_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "conversations_business_id_external_id_idx" ON "conversations" USING btree ("business_id","external_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "resources_business_id_idx" ON "resources" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "services_business_id_idx" ON "services" USING btree ("business_id");