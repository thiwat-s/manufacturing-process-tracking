CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

CREATE TYPE "ResourceCategory" AS ENUM ('MATERIAL', 'MACHINE_TIME', 'LABOUR_TIME');

CREATE TYPE "ProductionEventType" AS ENUM (
    'ORDER_CREATED',
    'STEP_STARTED',
    'CONSUMPTION_RECORDED',
    'STEP_COMPLETED'
);

CREATE TABLE
    "orders" (
        "id" UUID NOT NULL,
        "order_number" TEXT NOT NULL,
        "product_name" TEXT NOT NULL,
        "quantity" INTEGER NOT NULL,
        "due_date" DATE,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
    );

CREATE TABLE
    "production_steps" (
        "id" UUID NOT NULL,
        "code" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "sequence" INTEGER NOT NULL,
        CONSTRAINT "production_steps_pkey" PRIMARY KEY ("id")
    );

CREATE TABLE
    "order_steps" (
        "id" UUID NOT NULL,
        "order_id" UUID NOT NULL,
        "production_step_id" UUID NOT NULL,
        "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
        "started_at" TIMESTAMP(3),
        "completed_at" TIMESTAMP(3),
        CONSTRAINT "order_steps_pkey" PRIMARY KEY ("id")
    );

CREATE TABLE
    "resources" (
        "id" UUID NOT NULL,
        "name" TEXT NOT NULL,
        "category" "ResourceCategory" NOT NULL,
        "unit" TEXT NOT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
    );

CREATE TABLE
    "resource_consumptions" (
        "id" UUID NOT NULL,
        "order_step_id" UUID NOT NULL,
        "resource_id" UUID NOT NULL,
        "quantity" DECIMAL(14, 4) NOT NULL,
        "unit_snapshot" TEXT NOT NULL,
        "notes" TEXT,
        "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "resource_consumptions_pkey" PRIMARY KEY ("id")
    );

CREATE TABLE
    "production_events" (
        "id" UUID NOT NULL,
        "order_id" UUID NOT NULL,
        "order_step_id" UUID,
        "event_type" "ProductionEventType" NOT NULL,
        "description" TEXT NOT NULL,
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "production_events_pkey" PRIMARY KEY ("id")
    );

CREATE TABLE
    "order_number_counters" (
        "year" INTEGER NOT NULL,
        "value" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("year")
    );

CREATE UNIQUE INDEX "orders_order_number_key" ON "orders" ("order_number");

CREATE UNIQUE INDEX "production_steps_code_key" ON "production_steps" ("code");

CREATE UNIQUE INDEX "production_steps_sequence_key" ON "production_steps" ("sequence");

CREATE UNIQUE INDEX "order_steps_order_id_production_step_id_key" ON "order_steps" ("order_id", "production_step_id");

CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at");

CREATE INDEX "order_steps_status_production_step_id_idx" ON "order_steps" ("status", "production_step_id");

CREATE INDEX "resources_category_is_active_idx" ON "resources" ("category", "is_active");

CREATE INDEX "resource_consumptions_order_step_id_recorded_at_idx" ON "resource_consumptions" ("order_step_id", "recorded_at");

CREATE INDEX "resource_consumptions_resource_id_recorded_at_idx" ON "resource_consumptions" ("resource_id", "recorded_at");

CREATE INDEX "production_events_order_id_created_at_idx" ON "production_events" ("order_id", "created_at");

CREATE UNIQUE INDEX "unique_active_step_per_order" ON "order_steps" ("order_id")
WHERE
    "status" = 'IN_PROGRESS';

ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "resource_consumptions" ADD CONSTRAINT "resource_consumptions_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "order_steps" ADD CONSTRAINT "order_steps_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_steps" ADD CONSTRAINT "order_steps_production_step_id_fkey" FOREIGN KEY ("production_step_id") REFERENCES "production_steps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_consumptions" ADD CONSTRAINT "resource_consumptions_order_step_id_fkey" FOREIGN KEY ("order_step_id") REFERENCES "order_steps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_consumptions" ADD CONSTRAINT "resource_consumptions_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_events" ADD CONSTRAINT "production_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_events" ADD CONSTRAINT "production_events_order_step_id_fkey" FOREIGN KEY ("order_step_id") REFERENCES "order_steps" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;