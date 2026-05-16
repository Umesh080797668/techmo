-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('PHONE_LOGIN', 'EMAIL_VERIFY', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "refreshToken" TEXT;

-- CreateTable
CREATE TABLE "customer_otps" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "otp" CHAR(6) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_otps_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer_otps" ADD CONSTRAINT "customer_otps_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
