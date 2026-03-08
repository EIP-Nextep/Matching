import path from 'node:path';
import { defineConfig } from '@prisma/config';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
    migrations: {
        seed: 'npx ts-node prisma/seed.ts',
    },
    datasource: {
        url: process.env.DATABASE_URL!,
    },
});
