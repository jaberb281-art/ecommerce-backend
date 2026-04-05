import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const adminEmail = 'shbash@gmail.com';
    const rawPassword = 'ShbashAdmin2026!'; // Change this to your preferred secure password

    // Use 10 rounds to match your BCRYPT_ROUNDS env variable
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    console.log(`--- Seeding Admin: ${adminEmail} ---`);

    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            role: Role.ADMIN,
            password: hashedPassword,
        },
        create: {
            email: adminEmail,
            name: 'Shbash Admin',
            password: hashedPassword,
            role: Role.ADMIN,
        },
    });

    console.log(`✅ Admin account is ready!`);
    console.log(`📧 Email: ${admin.email}`);
    console.log(`🔑 Password: ${rawPassword}`);
}

main()
    .catch((e) => {
        console.error('Error seeding admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });