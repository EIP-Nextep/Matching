import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import * as xlsx from 'xlsx';
import * as fs from 'fs';

config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const dimensionMapping: Record<string, string> = {
  "realiste": "Realistic",
  "investigateur": "Investigative",
  "artistique": "Artistic",
  "social": "Social",
  "entreprenant": "Enterprising",
  "conventionnel": "Conventional",
  "ouverture": "Innovation",
  "conscienciosite": "Dependability",
  "extraversion": "Social Orientation",
  "agreabilite": "Cooperation",
  "stabilite_emotionnelle": "Stress Tolerance",
  "motivation": "Achievement Orientation",
  "patience": "Self-Control",
  "logique": "Intellectual Curiosity"
};

interface MetierJson {
  onetCode: string;
  name: string;
  description: string;
  domain: string;
}

interface MetiersFile {
  domains: string[];
  metiers: MetierJson[];
}

async function main() {
  console.log('--- Début du Seed ---');

  await prisma.result.deleteMany({});
  await prisma.metierInteraction.deleteMany({});
  await prisma.studentDimension.deleteMany({});
  await prisma.quizAnswer.deleteMany({});
  await prisma.metierDimension.deleteMany({});
  await prisma.metier.deleteMany({});
  await prisma.domainDimension.deleteMany({});
  await prisma.courseDomain.deleteMany({});
  await prisma.domain.deleteMany({});
  await prisma.option.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.dimension.deleteMany({});
  await prisma.studentProfile.deleteMany({});
  await prisma.course.deleteMany({});

  console.log('--- Chargement de metiers.json ---');
  const metiersFile: MetiersFile = JSON.parse(
    fs.readFileSync('prisma/raw_data/metiers.json', 'utf-8')
  );

  const selectedCodes = new Set(metiersFile.metiers.map(m => m.onetCode));

  console.log('--- Parsage des fichiers Excel ---');
  const interests = xlsx.utils.sheet_to_json<any>(
    xlsx.readFile('prisma/raw_data/Interests.xlsx').Sheets['Interests']
  );
  const workStyles = xlsx.utils.sheet_to_json<any>(
    xlsx.readFile('prisma/raw_data/Work_Styles.xlsx').Sheets['Work Styles']
  );

  const ignoredElements = [
    'First Interest High-Point',
    'Second Interest High-Point',
    'Third Interest High-Point',
  ];

  const jobs = new Map<string, { dims: Record<string, number> }>();

  function processRow(row: any) {
    if (ignoredElements.includes(row['Element Name'])) return;
    const code = row['O*NET-SOC Code'];
    if (!code || !selectedCodes.has(code)) return;

    if (!jobs.has(code)) {
      jobs.set(code, { dims: {} });
    }
    const elem = row['Element Name'];
    const val = Number(row['Data Value']) || 0;
    jobs.get(code)!.dims[elem] = val;
  }

  interests.forEach(processRow);
  workStyles.forEach(processRow);

  console.log('--- Insertion des dimensions ---');
  const allDimensionNames = new Set<string>();

  const quizDimensionKeys = [
    "ouverture", "conscienciosite", "extraversion", "agreabilite",
    "stabilite_emotionnelle", "realiste", "investigateur",
    "artistique", "social", "entreprenant", "conventionnel", "motivation",
    "patience", "logique"
  ];
  for (const key of quizDimensionKeys) {
    allDimensionNames.add(dimensionMapping[key] || key);
  }

  for (const job of jobs.values()) {
    for (const elem of Object.keys(job.dims)) {
      allDimensionNames.add(elem);
    }
  }

  const createdDimensions: Record<string, any> = {};
  for (const name of allDimensionNames) {
    const dim = await prisma.dimension.create({ data: { name } });
    createdDimensions[name] = dim;
  }
  const dimMap = new Map(
    Object.entries(createdDimensions).map(([key, val]) => [key, val.id])
  );

  console.log('--- Insertion des domaines ---');
  const dMap = new Map<string, string>(); // domainName → domainId
  for (const domainName of metiersFile.domains) {
    const domain = await prisma.domain.create({ data: { name: domainName } });
    dMap.set(domainName, domain.id);
  }

  console.log('--- Insertion des métiers et poids ---');

  // On collecte les poids normalisés par domaine pour calculer les DomainDimensions après
  const domainDimAccum = new Map<string, Record<string, { total: number; count: number }>>();

  for (const metierJson of metiersFile.metiers) {
    const jobData = jobs.get(metierJson.onetCode);
    if (!jobData) {
      console.warn(`⚠️  O*NET code ${metierJson.onetCode} (${metierJson.name}) non trouvé dans l'Excel, ignoré.`);
      continue;
    }

    const domainId = dMap.get(metierJson.domain);
    if (!domainId) {
      console.warn(`⚠️  Domaine "${metierJson.domain}" non trouvé pour ${metierJson.name}, ignoré.`);
      continue;
    }

    // Normaliser les poids du métier : somme = 1
    const totalScore = Object.values(jobData.dims).reduce((sum, v) => sum + v, 0);
    if (totalScore === 0) {
      console.warn(`⚠️  Score total = 0 pour ${metierJson.name}, ignoré.`);
      continue;
    }

    const normalizedDims: Record<string, number> = {};
    for (const [elem, score] of Object.entries(jobData.dims)) {
      normalizedDims[elem] = score / totalScore;
    }

    const metierDimsCreate = Object.entries(normalizedDims)
      .filter(([elem]) => dimMap.has(elem))
      .map(([elem, weight]) => ({
        dimensionId: dimMap.get(elem)!,
        weight,
      }));

    await prisma.metier.create({
      data: {
        name: metierJson.name,
        description: metierJson.description,
        onetCode: metierJson.onetCode,
        domainId,
        dimensions: { create: metierDimsCreate },
      },
    });

    // Accumuler pour les poids du domaine
    if (!domainDimAccum.has(metierJson.domain)) {
      domainDimAccum.set(metierJson.domain, {});
    }
    const domAccum = domainDimAccum.get(metierJson.domain)!;
    for (const [elem, weight] of Object.entries(normalizedDims)) {
      if (!domAccum[elem]) domAccum[elem] = { total: 0, count: 0 };
      domAccum[elem].total += weight;
      domAccum[elem].count += 1;
    }
  }

  console.log('--- Insertion des poids des domaines ---');
  for (const [domainName, dimAccum] of domainDimAccum.entries()) {
    const domainId = dMap.get(domainName)!;

    const avgDims: Record<string, number> = {};
    for (const [elem, { total, count }] of Object.entries(dimAccum)) {
      avgDims[elem] = total / count;
    }

    const totalWeight = Object.values(avgDims).reduce((sum, v) => sum + v, 0);
    const domDimsData = Object.entries(avgDims)
      .filter(([elem]) => dimMap.has(elem))
      .map(([elem, avg]) => ({
        domainId,
        dimensionId: dimMap.get(elem)!,
        weight: totalWeight > 0 ? avg / totalWeight : 0,
      }));

    for (const d of domDimsData) {
      await prisma.domainDimension.create({ data: d });
    }
  }

  console.log('--- Insertion des questions ---');
  const fullQuestions = [
    {
      order: 1, category: "Aspirations",
      text: "Quand tu imagines ton futur métier, tu veux surtout :",
      dimensionName: "motivation",
      options: [
        { letter: 'A', title: 'Exprimer ta créativité et ton identité', dimension: 'artistique' },
        { letter: 'B', title: 'Défendre des causes ou influencer', dimension: 'entreprenant' },
        { letter: 'C', title: 'Soigner ou améliorer la vie des autres', dimension: 'social' },
        { letter: 'D', title: 'Devenir expert dans un domaine complexe', dimension: 'investigateur' },
        { letter: 'E', title: 'Diriger et porter des projets ambitieux', dimension: 'entreprenant' },
        { letter: 'F', title: 'Un métier stable et structuré', dimension: 'conventionnel' },
      ]
    },
    {
      order: 2, category: "Satisfaction",
      text: "Ce qui te rend le plus fier à la fin d'une journée :",
      dimensionName: "motivation",
      options: [
        { letter: 'A', title: 'Avoir créé quelque chose d\'original', dimension: 'artistique' },
        { letter: 'B', title: 'Avoir aidé quelqu\'un à avancer', dimension: 'social' },
        { letter: 'C', title: 'Avoir résolu un problème difficile', dimension: 'investigateur' },
        { letter: 'D', title: 'Avoir pris une décision stratégique', dimension: 'entreprenant' },
        { letter: 'E', title: 'Avoir fait avancer un projet important', dimension: 'motivation' },
        { letter: 'F', title: 'Avoir tout bien organisé', dimension: 'conventionnel' },
      ]
    },
    {
      order: 3, category: "Stress",
      text: "Ce qui te fatigue le plus :",
      dimensionName: "stabilite_emotionnelle",
      options: [
        { letter: 'A', title: 'Le manque de liberté ou de créativité', dimension: 'ouverture' },
        { letter: 'B', title: 'Les conflits et les tensions humaines', dimension: 'agreabilite' },
        { letter: 'C', title: 'Une pression constante et compétitive', dimension: 'stabilite_emotionnelle' },
        { letter: 'D', title: 'Les tâches répétitives et sans sens', dimension: 'motivation' },
        { letter: 'E', title: 'L\'incertitude et l\'instabilité', dimension: 'conventionnel' },
        { letter: 'F', title: 'Le désordre et l\'improvisation', dimension: 'conscienciosite' },
      ]
    },
    {
      order: 4, category: "Environnement",
      text: "Dans un environnement de travail, tu supportes mal :",
      dimensionName: "ouverture",
      options: [
        { letter: 'A', title: 'Un cadre trop rigide', dimension: 'ouverture' },
        { letter: 'B', title: 'Une ambiance froide ou distante', dimension: 'social' },
        { letter: 'C', title: 'Un rythme trop intense', dimension: 'stabilite_emotionnelle' },
        { letter: 'D', title: 'Un manque de reconnaissance', dimension: 'motivation' },
        { letter: 'E', title: 'L\'absence de défis intellectuels', dimension: 'investigateur' },
        { letter: 'F', title: 'Le manque de sécurité', dimension: 'conventionnel' },
      ]
    },
    {
      order: 5, category: "Pression",
      text: "Face à une forte pression :",
      dimensionName: "stabilite_emotionnelle",
      options: [
        { letter: 'A', title: 'Tu préfères un cadre plus calme', dimension: 'stabilite_emotionnelle' },
        { letter: 'B', title: 'Tu tiens, mais ça te coûte mentalement', dimension: 'conscienciosite' },
        { letter: 'C', title: 'Tu gères si tu as du sens', dimension: 'motivation' },
        { letter: 'D', title: 'Ça te stimule et te motive', dimension: 'extraversion' },
        { letter: 'E', title: 'Tu prends naturellement le contrôle', dimension: 'entreprenant' },
        { letter: 'F', title: 'Tu cherches à structurer la situation', dimension: 'conventionnel' },
      ]
    },
    {
      order: 6, category: "Aversion",
      text: "Tu te sentirais mal dans un métier où :",
      dimensionName: "agreabilite",
      options: [
        { letter: 'A', title: 'Il faut être constamment en compétition', dimension: 'agreabilite' },
        { letter: 'B', title: 'Gérer des urgences fréquentes', dimension: 'stabilite_emotionnelle' },
        { letter: 'C', title: 'Parler en public très souvent', dimension: 'extraversion' },
        { letter: 'D', title: 'Être ultra créatif en permanence', dimension: 'conventionnel' },
        { letter: 'E', title: 'Suivre des règles très strictes', dimension: 'ouverture' },
        { letter: 'F', title: 'Prendre des décisions lourdes', dimension: 'conscienciosite' },
      ]
    },
    {
      order: 7, category: "Vision",
      text: "Dans 10 ans, ce qui te rendrait le plus fier serait :",
      dimensionName: "motivation",
      options: [
        { letter: 'A', title: 'Une trace créative personnelle', dimension: 'artistique' },
        { letter: 'B', title: 'Ta compétence et ton sérieux', dimension: 'conscienciosite' },
        { letter: 'C', title: 'Impact positif sur les autres', dimension: 'social' },
        { letter: 'D', title: 'Avoir porté un projet important', dimension: 'entreprenant' },
        { letter: 'E', title: 'Une carrière équilibrée et stable', dimension: 'conventionnel' },
        { letter: 'F', title: 'Participer à des décisions de société', dimension: 'entreprenant' },
      ]
    },
    {
      order: 8, category: "Identité",
      text: "Le mot qui te ressemble le plus :",
      dimensionName: "artistique",
      options: [
        { letter: 'A', title: 'Créatif', dimension: 'artistique' },
        { letter: 'B', title: 'Protecteur', dimension: 'social' },
        { letter: 'C', title: 'Stratège', dimension: 'entreprenant' },
        { letter: 'D', title: 'Leader', dimension: 'entreprenant' },
        { letter: 'E', title: 'Analyste', dimension: 'investigateur' },
        { letter: 'F', title: 'Organisé', dimension: 'conventionnel' },
      ]
    },
    {
      order: 9, category: "Engagement",
      text: "Pour atteindre ce futur, tu serais prêt à accepter :",
      dimensionName: "motivation",
      options: [
        { letter: 'A', title: 'Un parcours long et exigeant', dimension: 'investigateur' },
        { letter: 'B', title: 'Apprentissage pratique sur le terrain', dimension: 'realiste' },
        { letter: 'C', title: 'Alternance avec responsabilités', dimension: 'entreprenant' },
        { letter: 'D', title: 'Cadre créatif incertain', dimension: 'ouverture' },
        { letter: 'E', title: 'Cadre structuré et progressif', dimension: 'conventionnel' },
      ]
    },
    {
      order: 10, category: "Équilibre",
      text: "Ton équilibre idéal :",
      dimensionName: "motivation",
      options: [
        { letter: 'A', title: 'Passion avant tout', dimension: 'ouverture' },
        { letter: 'B', title: 'Impact humain', dimension: 'social' },
        { letter: 'C', title: 'Réussite et ambition', dimension: 'entreprenant' },
        { letter: 'D', title: 'Excellence académique', dimension: 'investigateur' },
        { letter: 'E', title: 'Sécurité et stabilité', dimension: 'conventionnel' },
        { letter: 'F', title: 'Créativité avec équilibre', dimension: 'artistique' },
      ]
    },
    {
      order: 11, category: "Critères",
      text: "Quand tu choisis une formation, tu privilégies :",
      dimensionName: "motivation",
      options: [
        { letter: 'A', title: 'La passion avant tout', dimension: 'motivation' },
        { letter: 'B', title: 'Équilibre passion + débouchés', dimension: 'conscienciosite' },
        { letter: 'C', title: 'La sécurité de l\'emploi', dimension: 'conventionnel' },
        { letter: 'D', title: 'Le salaire potentiel', dimension: 'entreprenant' },
        { letter: 'E', title: 'La possibilité d\'évolution rapide', dimension: 'motivation' },
      ]
    },
    {
      order: 12, category: "Durée",
      text: "Tu serais prêt à étudier pendant :",
      dimensionName: "conscienciosite",
      options: [
        { letter: 'A', title: '2-3 ans maximum', dimension: 'realiste' },
        { letter: 'B', title: '5 ans', dimension: 'conscienciosite' },
        { letter: 'C', title: '5 ans +', dimension: 'investigateur' },
        { letter: 'D', title: 'Peu importe si c\'est une passion', dimension: 'motivation' },
      ]
    },
    {
      order: 13, category: "Budget",
      text: "Le coût des études est-il un critère déterminant ?",
      dimensionName: "conventionnel",
      options: [
        { letter: 'A', title: 'Oui, priority au public/aides', dimension: 'conventionnel' },
        { letter: 'B', title: 'Important mais ouvert au privé', dimension: 'motivation' },
        { letter: 'C', title: 'Pas prioritaire si ça me correspond', dimension: 'ouverture' },
        { letter: 'D', title: 'Le budget n\'est pas une contrainte', dimension: 'extraversion' },
      ]
    }
  ];

  for (const qData of fullQuestions) {
    const parentDimName = dimensionMapping[qData.dimensionName] || qData.dimensionName;
    await prisma.question.create({
      data: {
        text: qData.text,
        category: qData.category,
        order: qData.order,
        imageUrl: "/Quiz.png",
        dimensionId: dimMap.get(parentDimName)!,
        options: {
          create: qData.options.map(o => {
            const mappedName = dimensionMapping[o.dimension] || o.dimension;
            return {
              letter: o.letter,
              title: o.title,
              dimensionName: mappedName
            };
          })
        }
      }
    });
  }


  console.log('--- Récupération des courses depuis le catalog ---');
  try {
    const res = await fetch('http://localhost:3005/courses');
    if (res.ok) {
      const courses: any[] = await res.json();
      console.log(`✅ ${courses.length} courses récupérés.`);

      for (const course of courses) {
        await prisma.course.upsert({
          where: { id: course.id },
          update: {},
          create: { id: course.id }
        });

        const domainIdentifiers = course.domainIds || course.domains || [];
        for (const dId of domainIdentifiers) {
          let realDomainId = dMap.get(dId);

          if (!realDomainId) {
            const existing = await prisma.domain.findUnique({ where: { id: dId } }).catch(() => null);
            if (existing) {
              realDomainId = existing.id;
            } else {
              const byName = await prisma.domain.findFirst({ where: { name: dId } }).catch(() => null);
              if (byName) realDomainId = byName.id;
            }
          }

          if (realDomainId) {
            // Using upsert or checking if it exists to avoid unique constraint if there is one on courseDomain
            // but the schema says @id @default(uuid()), courseId, domainId, no compound unique constraint
            // To be safe, just create, or check if it already exists
            const existingCd = await prisma.courseDomain.findFirst({
              where: { courseId: course.id, domainId: realDomainId }
            });
            if (!existingCd) {
              await prisma.courseDomain.create({
                data: {
                  courseId: course.id,
                  domainId: realDomainId
                }
              });
            }
          } else {
            console.warn(`⚠️ Domaine non trouvé pour identifiant: ${dId} sur le course ${course.id}`);
          }
        }
      }
    } else {
      console.warn(`⚠️ Impossible de récupérer les courses, status: ${res.status}`);
    }
  } catch (err) {
    console.error(`⚠️ Erreur lors du fetch des courses:`, err);
  }

  console.log('--- Seed terminé avec succès ! ---');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
