-- Add picking progress tracking to each SalesOrderItem.
ALTER TABLE `SalesOrderItem`
ADD COLUMN `pickedQuantity` INTEGER NOT NULL DEFAULT 0;
