-- AlterTable
ALTER TABLE `salesorder` ADD COLUMN `shippingProvider` VARCHAR(191) NULL,
    ADD COLUMN `trackingNumber` VARCHAR(191) NULL;
