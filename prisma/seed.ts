import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Début du seeding...');

  const infoDomain = await prisma.domain.upsert({
    where: { name: 'Informatique & Numérique' },
    update: {},
    create: { name: 'Informatique & Numérique' }
  });

  const santeDomain = await prisma.domain.upsert({
    where: { name: 'Santé & Social' },
    update: {},
    create: { name: 'Santé & Social' }
  });

  const logiqueDimension = await prisma.dimension.upsert({
    where: { name: 'Logique & Analyse' },
    update: {},
    create: { name: 'Logique & Analyse' }
  });

  const socialDimension = await prisma.dimension.upsert({
    where: { name: 'Relationnel & Empathie' },
    update: {},
    create: { name: 'Relationnel & Empathie' }
  });

  console.log('Seed domains et dimensions créé.');

  const questionsCount = await prisma.question.count();
  if (questionsCount === 0) {
    await prisma.question.createMany({
      data: [
        {
          question: "Aimez-vous résoudre des problèmes logiques ou mathématiques ?",
          dimensionId: logiqueDimension.id
        },
        {
          question: "Pensez-vous qu'il est indispensable d'aider les autres au quotidien ?",
          dimensionId: socialDimension.id
        }
      ]
    });
    console.log('Questions initialisées.');
  }

  console.log('Seeding terminé avec succès !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
