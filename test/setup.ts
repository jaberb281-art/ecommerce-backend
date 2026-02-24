import { execSync } from 'child_process';

module.exports = async () => {
    // Point to test database before running E2E tests
    process.env.DATABASE_URL =
        'postgresql://postgres:12345@localhost:5432/ecommerce_test?schema=public';

    // Clean all tables before test run
    execSync('npx prisma db push --force-reset', {
        env: { ...process.env },
        stdio: 'inherit',
    });
};