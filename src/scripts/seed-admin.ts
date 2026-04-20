import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    if (!adminEmail) {
        console.error('❌ SEED_ADMIN_EMAIL is not set. Refusing to seed.');
        console.error('   Run: SEED_ADMIN_EMAIL=you@example.com npx ts-node src/scripts/seed-admin.ts');
        process.exit(1);
    }

    const existing = await prisma.user.findUnique({
        where: { email: adminEmail },
        select: { id: true, role: true },
    });

    if (existing) {
        if (existing.role === Role.ADMIN) {
            console.log(`✅ Admin already exists for ${adminEmail}. Nothing to do.`);
            return;
        }
        // Promote existing user without touching their password
        await prisma.user.update({
            where: { id: existing.id },
            data: { role: Role.ADMIN },
        });
        console.log(`✅ Promoted ${adminEmail} to ADMIN. Password was NOT changed.`);
        return;
    }

    // New admin — use env password or generate a secure random one
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const envPassword = process.env.SEED_ADMIN_PASSWORD;
    const rawPassword = envPassword ?? crypto.randomBytes(18).toString('base64url');
    const hashedPassword = await bcrypt.hash(rawPassword, rounds);

    const admin = await prisma.user.create({
        data: {
            email: adminEmail,
            name: process.env.SEED_ADMIN_NAME ?? 'Shbash Admin',
            password: hashedPassword,
            role: Role.ADMIN,
        },
    });

    console.log(`✅ Admin account created!`);
    console.log(`📧 Email: ${admin.email}`);
    if (!envPassword) {
        console.log(`🔑 Generated password (save this — it will NOT be shown again):`);
        console.log(`   ${rawPassword}`);
    }
}

main()
    .catch((e) => {
        console.error('Error seeding admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });