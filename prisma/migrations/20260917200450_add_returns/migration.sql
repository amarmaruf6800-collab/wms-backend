-- CreateTable
CREATE TABLE `SalesReturn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `returnNumber` VARCHAR(191) NOT NULL,
    `salesOrderId` INTEGER NOT NULL,
    `warehouseId` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
    `reason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NULL,
    `inspectedAt` DATETIME(3) NULL,
    `restockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalesReturn_returnNumber_key`(`returnNumber`),
    INDEX `SalesReturn_salesOrderId_idx`(`salesOrderId`),
    INDEX `SalesReturn_warehouseId_idx`(`warehouseId`),
    INDEX `SalesReturn_status_idx`(`status`),
    INDEX `SalesReturn_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalesReturnItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `salesReturnId` INTEGER NOT NULL,
    `salesOrderItemId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `condition` VARCHAR(191) NOT NULL DEFAULT 'GOOD',
    `restockedQuantity` INTEGER NOT NULL DEFAULT 0,
    `locationId` INTEGER NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `SalesReturnItem_salesReturnId_idx`(`salesReturnId`),
    INDEX `SalesReturnItem_salesOrderItemId_idx`(`salesOrderItemId`),
    INDEX `SalesReturnItem_productId_idx`(`productId`),
    INDEX `SalesReturnItem_locationId_idx`(`locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SalesReturn` ADD CONSTRAINT `SalesReturn_salesOrderId_fkey` FOREIGN KEY (`salesOrderId`) REFERENCES `SalesOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesReturn` ADD CONSTRAINT `SalesReturn_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesReturnItem` ADD CONSTRAINT `SalesReturnItem_salesReturnId_fkey` FOREIGN KEY (`salesReturnId`) REFERENCES `SalesReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesReturnItem` ADD CONSTRAINT `SalesReturnItem_salesOrderItemId_fkey` FOREIGN KEY (`salesOrderItemId`) REFERENCES `SalesOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesReturnItem` ADD CONSTRAINT `SalesReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalesReturnItem` ADD CONSTRAINT `SalesReturnItem_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `WarehouseLocation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
