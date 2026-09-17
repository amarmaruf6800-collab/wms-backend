# Sales Order Backend Update

Added Sales Order module on top of WMS-backend-finalized-v2.

## New Prisma models
- Customer
- SalesOrder
- SalesOrderItem

## New routes
- GET /api/customers
- POST /api/customers (ADMIN)
- PUT /api/customers/:id (ADMIN)
- GET /api/sales-orders
- GET /api/sales-orders/:id
- POST /api/sales-orders
- PATCH /api/sales-orders/:id/status
- DELETE /api/sales-orders/:id (ADMIN)

## Sales Order statuses
DRAFT -> CONFIRMED -> PICKING -> PACKED -> SHIPPED -> DELIVERED

Cancellation is allowed from DRAFT, CONFIRMED, and PICKING.

## Important
Creating or confirming a Sales Order does not reduce inventory yet.
Inventory reduction will be handled by the Picking module so StockMovement remains an accurate audit trail.
