const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.create({
    data: { email: 'admin@shbash.com', password: hash, name: 'Admin', role: 'ADMIN' }
  });
  console.log('Created:', user.email);
}
main().catch(console.error).finally(() => prisma.$disconnect());
