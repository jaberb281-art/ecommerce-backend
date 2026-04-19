/**
 * prisma/seed.ts
 *
 * Run with:  npx prisma db seed
 *
 * Safe to run multiple times — uses upsert everywhere so it will never
 * duplicate data or crash on an already-seeded database.
 */

import { PrismaClient, ProductStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES = [
    {
        name: 'iPhone Cases',
        image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400',
    },
    {
        name: 'Samsung Cases',
        image: 'https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=400',
    },
    {
        name: 'Accessories',
        image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400',
    },
    {
        name: 'Limited Edition',
        image: 'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=400',
    },
]

// ─── Products (keyed by category name) ───────────────────────────────────────

const PRODUCTS: Array<{
    slug: string           // used as stable seed ID
    categoryName: string
    name: string
    description: string
    price: number
    stock: number
    images: string[]
    status: ProductStatus
}> = [
        // iPhone Cases
        {
            slug: 'iphone-15-pro-carbon',
            categoryName: 'iPhone Cases',
            name: 'iPhone 15 Pro Carbon Case',
            description: 'Military-grade protection with a carbon fibre finish. MagSafe compatible.',
            price: 14.99,
            stock: 50,
            images: ['https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=600'],
            status: 'ACTIVE',
        },
        {
            slug: 'iphone-15-clear-armour',
            categoryName: 'iPhone Cases',
            name: 'iPhone 15 Clear Armour',
            description: 'Crystal-clear hard shell — show off your phone colour.',
            price: 8.99,
            stock: 120,
            images: ['https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=600'],
            status: 'ACTIVE',
        },
        {
            slug: 'iphone-14-pro-leather-wallet',
            categoryName: 'iPhone Cases',
            name: 'iPhone 14 Pro Leather Wallet',
            description: 'Genuine leather flip case with three card slots and a cash pocket.',
            price: 22.50,
            stock: 30,
            images: ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600'],
            status: 'ACTIVE',
        },
        // Samsung Cases
        {
            slug: 'galaxy-s24-frosted',
            categoryName: 'Samsung Cases',
            name: 'Galaxy S24 Ultra Frosted Case',
            description: 'Frosted matte finish, anti-fingerprint coating, precise cutouts.',
            price: 12.99,
            stock: 75,
            images: ['https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=600'],
            status: 'ACTIVE',
        },
        {
            slug: 'galaxy-a55-rugged',
            categoryName: 'Samsung Cases',
            name: 'Galaxy A55 Rugged Case',
            description: 'Triple-layer shock absorption. Survives 2m drops.',
            price: 10.99,
            stock: 60,
            images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600'],
            status: 'ACTIVE',
        },
        // Accessories
        {
            slug: 'magsafe-ring-holder',
            categoryName: 'Accessories',
            name: 'MagSafe Ring Holder',
            description: 'Universal magnetic ring grip that attaches to any MagSafe-compatible case.',
            price: 6.99,
            stock: 200,
            images: ['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600'],
            status: 'ACTIVE',
        },
        {
            slug: 'usbc-fast-charger-20w',
            categoryName: 'Accessories',
            name: '20W USB-C Fast Charger',
            description: 'GaN technology. Compatible with iPhone 12+ and all USB-C devices.',
            price: 18.00,
            stock: 90,
            images: ['https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=600'],
            status: 'ACTIVE',
        },
        {
            slug: 'screen-protector-iphone15-3pack',
            categoryName: 'Accessories',
            name: 'Screen Protector 3-Pack (iPhone 15)',
            description: '9H tempered glass, full-adhesive, includes alignment tray.',
            price: 7.50,
            stock: 150,
            images: ['https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=600'],
            status: 'ACTIVE',
        },
        // Limited Edition
        {
            slug: 'arabic-calligraphy-iphone15pro',
            categoryName: 'Limited Edition',
            name: 'Arabic Calligraphy Case — iPhone 15 Pro',
            description: 'Hand-designed Arabic calligraphy print. Limited run of 100 units.',
            price: 29.99,
            stock: 15,
            images: ['https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=600'],
            status: 'ACTIVE',
        },
        {
            slug: 'bahrain-gp-iphone14',
            categoryName: 'Limited Edition',
            name: 'Bahrain GP Edition Case — iPhone 14',
            description: 'Commemorating the Bahrain Grand Prix. Collector\'s item.',
            price: 34.99,
            stock: 8,
            images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600'],
            status: 'ACTIVE',
        },
    ]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🌱  Starting seed...\n')

    // ── Admin user ──────────────────────────────────────────────────────────
    // Password satisfies RegisterDto: 1 uppercase + 1 lowercase + 1 digit
    const adminPassword = await bcrypt.hash('Admin123!', 12)
    const admin = await prisma.user.upsert({
        where: { email: 'admin@shbash.com' },
        update: {},
        create: {
            email: 'admin@shbash.com',
            name: 'Shbash Admin',
            role: 'ADMIN',
            password: adminPassword,
            username: 'shbash_admin',
        },
    })
    console.log(`✅  Admin:        ${admin.email}  /  Admin123!`)

    // ── Categories ──────────────────────────────────────────────────────────
    const categoryMap: Record<string, string> = {}

    for (const cat of CATEGORIES) {
        const row = await prisma.category.upsert({
            where: { name: cat.name },
            update: { image: cat.image },
            create: cat,
        })
        categoryMap[cat.name] = row.id
        console.log(`✅  Category:     ${row.name}`)
    }

    // ── Products ────────────────────────────────────────────────────────────
    let count = 0
    for (const p of PRODUCTS) {
        const categoryId = categoryMap[p.categoryName]
        if (!categoryId) {
            console.warn(`⚠️  Skipping "${p.name}" — category "${p.categoryName}" not found`)
            continue
        }
        await prisma.product.upsert({
            where: { id: `seed-${p.slug}` },
            update: { price: p.price, stock: p.stock, description: p.description },
            create: {
                id: `seed-${p.slug}`,
                name: p.name,
                description: p.description,
                price: p.price,
                stock: p.stock,
                images: p.images,
                status: p.status,
                categoryId,
            },
        })
        count++
    }
    console.log(`✅  Products:     ${count} upserted`)

    // ── ShopSettings singleton ──────────────────────────────────────────────
    await prisma.shopSettings.upsert({
        where: { id: 'singleton' },
        update: {},
        create: {
            id: 'singleton',
            announcementSlides: [
                { text: '🔥 New arrivals every Friday — follow us on Instagram!' },
                { text: '🚚 Free delivery on orders over BD 10' },
                { text: '🇧🇭 Proudly made in Bahrain' },
            ],
            heroTitle: 'Own Your Identity.',
            heroSubtitle: 'Handcrafted phone cases. Limited drops. Express your culture.',
            heroButtonText: 'Shop Now',
            heroButtonLink: '/shop',
            heroImageUrl: 'https://images.unsplash.com/photo-1512499617640-c74ae3a79d37?w=1200',
            bannerText: '🔥 New drop live now — Limited Edition Bahrain GP cases!',
            isBannerVisible: true,
        },
    })
    console.log(`✅  ShopSettings: singleton upserted`)

    console.log('\n✨  Done! Admin login: admin@shbash.com / Admin123!')
}

main()
    .catch((e) => {
        console.error('❌  Seed failed:', e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())