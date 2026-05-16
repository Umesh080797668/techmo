-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE_IN', 'SALE_OUT', 'REPAIR_USED', 'RETURN_IN', 'ADJUSTMENT', 'TRANSFER', 'DAMAGE_LOSS', 'INITIAL_STOCK');

-- CreateEnum
CREATE TYPE "StocktakeStatus" AS ENUM ('IN_PROGRESS', 'SYNCED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'MATCHED', 'DISCREPANCY');

-- CreateEnum
CREATE TYPE "BatteryAlertType" AS ENUM ('APPROACHING_SHELF_LIMIT', 'SHELF_LIMIT_EXCEEDED', 'CRITICAL_AGE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "sku" TEXT NOT NULL,
    "branchId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "lowStockQty" INTEGER NOT NULL DEFAULT 5,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "performedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_sessions" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "StocktakeStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "stocktake_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_scans" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "scannedQty" INTEGER NOT NULL DEFAULT 1,
    "systemQty" INTEGER,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "scannedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocktake_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battery_stock_entries" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "manufacturedAt" TIMESTAMP(3),
    "shelfLifeDays" INTEGER NOT NULL,
    "alertFractionPct" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "batchNumber" TEXT,
    "ratedCapacityMah" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "battery_stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battery_alerts" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "alertType" "BatteryAlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "daysOnShelf" INTEGER NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battery_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_sku_key" ON "inventory"("sku");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_scans" ADD CONSTRAINT "stocktake_scans_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "stocktake_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_stock_entries" ADD CONSTRAINT "battery_stock_entries_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "inventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battery_alerts" ADD CONSTRAINT "battery_alerts_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "battery_stock_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
