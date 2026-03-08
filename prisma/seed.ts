import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['query', 'info', 'warn', 'error'] });

async function main() {
  console.log('--- Début du Seed ---');

  await prisma.option.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.dimension.deleteMany({});

  const dimensions = [
    "ouverture", "conscienciosite", "extraversion", "agreabilite",
    "stabilite_emotionnelle", "realiste", "investigateur",
    "artistique", "social", "entreprenant", "conventionnel", "motivation"
  ];

  const createdDimensions: Record<string, any> = {};
  for (const name of dimensions) {
    const dim = await prisma.dimension.create({ data: { name } });
    createdDimensions[name] = dim;
  }

  // 3. Liste des Questions
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
        { letter: 'A', title: '2–3 ans maximum', dimension: 'realiste' },
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
        { letter: 'A', title: 'Oui, priorité au public/aides', dimension: 'conventionnel' },
        { letter: 'B', title: 'Important mais ouvert au privé', dimension: 'motivation' },
        { letter: 'C', title: 'Pas prioritaire si ça me correspond', dimension: 'ouverture' },
        { letter: 'D', title: 'Le budget n\'est pas une contrainte', dimension: 'extraversion' },
      ]
    }
  ];

  for (const qData of fullQuestions) {
    await prisma.question.create({
      data: {
        text: qData.text,
        category: qData.category,
        order: qData.order,
        imageUrl: "/Quiz.png",
        dimensionId: createdDimensions[qData.dimensionName].id,
        options: {
          create: qData.options.map(o => ({
            letter: o.letter,
            title: o.title,
            dimensionName: o.dimension
          }))
        }
      }
    });
  }

  console.log('--- Seed Terminé : 13 questions insérées ---');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
