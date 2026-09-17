const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const main = async () => {
    const warehouses = await prisma.warehouse.findMany();

    for (const warehouse of warehouses) {
        const defaultLocation = await prisma.warehouseLocation.upsert({
            where: {
                warehouseId_code: {
                    warehouseId: warehouse.id,
                    code: 'GENERAL'
                }
            },
            update: { isActive: true },
            create: {
                warehouseId: warehouse.id,
                code: 'GENERAL',
                name: 'General / No Bin',
                isActive: true
            }
        });

        await prisma.inventory.updateMany({
            where: {
                warehouseId: warehouse.id,
                locationId: null
            },
            data: {
                locationId: defaultLocation.id
            }
        });

        await prisma.stockMovement.updateMany({
            where: {
                warehouseId: warehouse.id,
                locationId: null
            },
            data: {
                locationId: defaultLocation.id
            }
        });
    }

    console.log('✅ Inventory dan stock movement lama sudah diarahkan ke location GENERAL.');
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
