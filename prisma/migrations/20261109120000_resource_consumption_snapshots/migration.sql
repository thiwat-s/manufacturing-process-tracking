ALTER TABLE "resource_consumptions"
ADD COLUMN "resource_name_snapshot" TEXT,
ADD COLUMN "resource_category_snapshot" "ResourceCategory";

UPDATE "resource_consumptions" AS consumption
SET
    "resource_name_snapshot" = resource."name",
    "resource_category_snapshot" = resource."category"
FROM "resources" AS resource
WHERE resource."id" = consumption."resource_id";

ALTER TABLE "resource_consumptions"
ALTER COLUMN "resource_name_snapshot" SET NOT NULL,
ALTER COLUMN "resource_category_snapshot" SET NOT NULL;
