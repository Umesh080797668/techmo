-- CreateEnum
CREATE TYPE "CompatibilityVoteType" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHONE', 'ACCESSORY', 'SPARE_PART', 'SERVICE');

-- CreateEnum
CREATE TYPE "ImeiStatus" AS ENUM ('IN_STOCK', 'SOLD', 'REPAIRED', 'RETURNED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "PricingRuleType" AS ENUM ('DISCOUNT_PERCENT', 'DISCOUNT_AMOUNT', 'COMBO_DISCOUNT', 'TIME_BASED', 'BULK');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateTable
CREATE TABLE "device_models" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "variant" TEXT,
    "releaseYear" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL DEFAULT 'ACCESSORY',
    "brand" TEXT,
    "barcode" TEXT,
    "costPrice" DECIMAL(12,2) NOT NULL,
    "sellingPrice" DECIMAL(12,2) NOT NULL,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "requiresImei" BOOLEAN NOT NULL DEFAULT false,
    "requiresSerial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "costPrice" DECIMAL(12,2),
    "sellingPrice" DECIMAL(12,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_compatibility" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "deviceModelId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "part_compatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compatibility_votes" (
    "id" TEXT NOT NULL,
    "compatibilityId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "vote" "CompatibilityVoteType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compatibility_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imei_records" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "imei" TEXT NOT NULL,
    "serialNumber" TEXT,
    "color" TEXT,
    "storage" TEXT,
    "status" "ImeiStatus" NOT NULL DEFAULT 'IN_STOCK',
    "soldAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imei_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "ruleType" "PricingRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountPct" DECIMAL(5,2),
    "discountAmt" DECIMAL(12,2),
    "minQty" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "requiresManagerPin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "comboRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claims" (
    "id" TEXT NOT NULL,
    "imeiRecordId" TEXT NOT NULL,
    "claimedById" TEXT NOT NULL,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'PENDING',
    "issue" TEXT NOT NULL,
    "resolution" TEXT,
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_models_brand_model_variant_key" ON "device_models"("brand", "model", "variant");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_barcode_key" ON "product_variants"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "part_compatibility_productId_deviceModelId_key" ON "part_compatibility"("productId", "deviceModelId");

-- CreateIndex
CREATE UNIQUE INDEX "compatibility_votes_compatibilityId_staffId_key" ON "compatibility_votes"("compatibilityId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "imei_records_imei_key" ON "imei_records"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "imei_records_serialNumber_key" ON "imei_records"("serialNumber");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_compatibility" ADD CONSTRAINT "part_compatibility_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_compatibility" ADD CONSTRAINT "part_compatibility_deviceModelId_fkey" FOREIGN KEY ("deviceModelId") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compatibility_votes" ADD CONSTRAINT "compatibility_votes_compatibilityId_fkey" FOREIGN KEY ("compatibilityId") REFERENCES "part_compatibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imei_records" ADD CONSTRAINT "imei_records_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_imeiRecordId_fkey" FOREIGN KEY ("imeiRecordId") REFERENCES "imei_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
