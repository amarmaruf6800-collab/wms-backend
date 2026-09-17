const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const main = async () => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'WMS Admin';

    if (!adminEmail || !adminPassword) {
        throw new Error('ADMIN_EMAIL dan ADMIN_PASSWORD wajib diatur di .env sebelum menjalankan seed.');
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail.toLowerCase() },
        update: {
            name: adminName,
            role: 'ADMIN',
            isActive: true
        },
        create: {
            name: adminName,
            email: adminEmail.toLowerCase(),
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true
        }
    });

    const warehouse = await prisma.warehouse.upsert({
        where: { code: 'WH-MAIN' },
        update: { isActive: true },
        create: {
            code: 'WH-MAIN',
            name: 'Main Warehouse',
            location: 'Head Office',
            isActive: true
        }
    });

    await prisma.warehouseLocation.upsert({
        where: {
            warehouseId_code: {
                warehouseId: warehouse.id,
                code: 'A-01'
            }
        },
        update: { isActive: true },
        create: {
            warehouseId: warehouse.id,
            code: 'A-01',
            name: 'Rack A-01',
            isActive: true
        }
    });

    await prisma.warehouseLocation.upsert({
        where: {
            warehouseId_code: {
                warehouseId: warehouse.id,
                code: 'A-02'
            }
        },
        update: { isActive: true },
        create: {
            warehouseId: warehouse.id,
            code: 'A-02',
            name: 'Rack A-02',
            isActive: true
        }
    });

    await prisma.product.upsert({
        where: { sku: 'SKU-DEMO-001' },
        update: { isActive: true },
        create: {
            sku: 'SKU-DEMO-001',
            name: 'Demo Product 001',
            description: 'Sample product for WMS development.',
            price: 100000,
            minStock: 10,
            isActive: true
        }
    });

    await prisma.product.upsert({
        where: { sku: 'SKU-DEMO-002' },
        update: { isActive: true },
        create: {
            sku: 'SKU-DEMO-002',
            name: 'Demo Product 002',
            description: 'Sample product for WMS development.',
            price: 50000,
            minStock: 5,
            isActive: true
        }
    });

    console.log(`✅ Seed selesai. Admin: ${admin.email}, Warehouse: ${warehouse.code}`);
};

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
