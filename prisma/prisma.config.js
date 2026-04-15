// prisma/prisma.config.ts
import 'dotenv/config';

export default {
    engine: 'classic',
    datasource: {
        url: process.env.DATABASE_URL,
    },
};