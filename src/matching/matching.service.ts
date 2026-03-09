import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CalculateDto, MetierInteractionDto } from './dto/matching.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuestions() {
    return this.prisma.question.findMany({
      include: {
        dimension: true,
        options: true,
      },
    });
  }

  async calculate(calculateDto: CalculateDto) {
    const { userId, answers } = calculateDto;

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new NotFoundException(`Student with userId ${userId} not found`);
    }

    if (!answers || answers.length === 0) {
      throw new BadRequestException(
        `No answers provided for student ${userId}`,
      );
    }

    await this.prisma.quizAnswer.deleteMany({
      where: { studentId: student.id },
    });

    await this.prisma.quizAnswer.createMany({
      data: answers.map((a) => ({
        studentId: student.id,
        questionId: a.questionId,
        optionId: a.optionId,
      })),
    });

    const quizAnswers = await this.prisma.quizAnswer.findMany({
      where: { studentId: student.id },
      include: { option: true },
    });

    const rawScores: Record<string, number> = {};
    for (const answer of quizAnswers) {
      const dimName = answer.option.dimensionName; // ex: "Artistic", "Realistic"
      rawScores[dimName] = (rawScores[dimName] || 0) + 1;
    }

    const allOptions = await this.prisma.option.findMany({
      select: { dimensionName: true, questionId: true },
    });

    const questionsPerDim: Record<string, Set<string>> = {};
    for (const opt of allOptions) {
      if (!questionsPerDim[opt.dimensionName]) {
        questionsPerDim[opt.dimensionName] = new Set();
      }
      questionsPerDim[opt.dimensionName].add(opt.questionId);
    }

    const maxScorePerDim: Record<string, number> = {};
    for (const [dimName, questionIds] of Object.entries(questionsPerDim)) {
      maxScorePerDim[dimName] = questionIds.size;
    }

    await this.prisma.studentDimension.deleteMany({
      where: { studentId: student.id },
    });

    const normalizedScores: Record<string, number> = {};
    const studentDimensionsData: {
      studentId: string;
      dimensionId: string;
      normalizedScore: number;
    }[] = [];

    for (const [dimName, rawScore] of Object.entries(rawScores)) {
      const dimension = await this.prisma.dimension.findUnique({
        where: { name: dimName },
      });
      if (!dimension) continue;

      const maxPossible = maxScorePerDim[dimName] || 1;
      const normalizedScore = Math.min(rawScore / maxPossible, 1);
      normalizedScores[dimension.id] = normalizedScore;

      studentDimensionsData.push({
        studentId: student.id,
        dimensionId: dimension.id,
        normalizedScore,
      });
    }

    if (studentDimensionsData.length > 0) {
      await this.prisma.studentDimension.createMany({
        data: studentDimensionsData,
      });
    }

    const domains = await this.prisma.domain.findMany({
      include: { dimensions: true },
    });

    const domainResults: { domainId: string; compatibility: number }[] = [];
    for (const domain of domains) {
      const weightSum = domain.dimensions.reduce((sum, d) => sum + d.weight, 0);

      let dotProduct = 0;
      for (const dDim of domain.dimensions) {
        const studentScore = normalizedScores[dDim.dimensionId] || 0;
        dotProduct += studentScore * dDim.weight;
      }

      const compatibility =
        weightSum > 0 && Math.abs(weightSum - 1) > 0.01
          ? dotProduct / weightSum
          : dotProduct;

      domainResults.push({
        domainId: domain.id,
        compatibility: parseFloat((compatibility * 100).toFixed(1)),
      });
    }

    domainResults.sort((a, b) => b.compatibility - a.compatibility);

    const metiers = await this.prisma.metier.findMany({
      include: { dimensions: true },
    });

    const metierResults: { metierId: string; compatibility: number }[] = [];
    for (const metier of metiers) {
      const weightSum = metier.dimensions.reduce((sum, d) => sum + d.weight, 0);

      let dotProduct = 0;
      for (const mDim of metier.dimensions) {
        const studentScore = normalizedScores[mDim.dimensionId] || 0;
        dotProduct += studentScore * mDim.weight;
      }

      const compatibility =
        weightSum > 0 && Math.abs(weightSum - 1) > 0.01
          ? dotProduct / weightSum
          : dotProduct;

      metierResults.push({
        metierId: metier.id,
        compatibility: parseFloat((compatibility * 100).toFixed(1)),
      });
    }

    metierResults.sort((a, b) => b.compatibility - a.compatibility);

    await this.prisma.result.deleteMany({
      where: { studentId: student.id },
    });

    const resultData = [
      ...domainResults.slice(0, 5).map((r) => ({
        studentId: student.id,
        domainId: r.domainId,
        compatibility: r.compatibility,
      })),
      ...metierResults.slice(0, 10).map((r) => ({
        studentId: student.id,
        metierId: r.metierId,
        compatibility: r.compatibility,
      })),
    ];

    await this.prisma.result.createMany({ data: resultData });

    return { message: 'Matching calculated successfully' };
  }

  async getRecommendedDomains(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!student) return [];

    const results = await this.prisma.result.findMany({
      where: { studentId: student.id, domainId: { not: null } },
      include: { domain: true },
      orderBy: { compatibility: 'desc' },
    });

    return results.map((r) => ({
      id: r.domain!.id,
      name: r.domain!.name,
      score: r.compatibility,
    }));
  }

  async getRecommendedMetiers(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!student) return [];

    const results = await this.prisma.result.findMany({
      where: { studentId: student.id, metierId: { not: null } },
      include: {
        metier: {
          include: {
            domain: true,
            dimensions: {
              include: { dimension: true },
              orderBy: { weight: 'desc' },
              take: 3,
            },
          },
        },
      },
      orderBy: { compatibility: 'desc' },
    });

    return results.map((r) => ({
      id: r.metier!.id,
      name: r.metier!.name,
      description: r.metier!.description,
      domain: r.metier!.domain.name,
      score: r.compatibility,
      topDimensions: r.metier!.dimensions.map((md) => ({
        name: md.dimension.name,
        weight: parseFloat((md.weight * 100).toFixed(1)),
      })),
    }));
  }

  async getRecommendedSchools(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!student) return [];

    // Récupérer les résultats domaine de l'étudiant
    const domainResults = await this.prisma.result.findMany({
      where: { studentId: student.id, domainId: { not: null } },
      orderBy: { compatibility: 'desc' },
    });

    const domainIds = domainResults
      .map((r) => r.domainId)
      .filter((id): id is string => id !== null);

    if (domainIds.length === 0) return [];

    // Trouver les écoles liées à ces domaines
    const schoolDomains = await this.prisma.schoolDomain.findMany({
      where: { domainId: { in: domainIds } },
      include: {
        school: true,
        domain: true,
      },
    });

    // Regrouper par école et calculer le meilleur match
    const schoolMap = new Map<
      string,
      {
        school: {
          id: string;
          name: string;
          location: string | null;
          url: string | null;
        };
        domains: string[];
        bestMatch: number;
      }
    >();

    for (const sd of schoolDomains) {
      const domainResult = domainResults.find(
        (r) => r.domainId === sd.domainId,
      );
      const match = domainResult?.compatibility || 0;

      if (!schoolMap.has(sd.schoolId)) {
        schoolMap.set(sd.schoolId, {
          school: sd.school,
          domains: [],
          bestMatch: 0,
        });
      }

      const entry = schoolMap.get(sd.schoolId)!;
      entry.domains.push(sd.domain.name);
      entry.bestMatch = Math.max(entry.bestMatch, match);
    }

    return Array.from(schoolMap.values())
      .sort((a, b) => b.bestMatch - a.bestMatch)
      .map((entry) => ({
        id: entry.school.id,
        name: entry.school.name,
        location: entry.school.location,
        url: entry.school.url,
        matchPercentage: entry.bestMatch,
        domains: entry.domains,
      }));
  }

  async interactMetier(dto: MetierInteractionDto) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: dto.userId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${dto.userId} not found`);
    }

    const metier = await this.prisma.metier.findUnique({
      where: { id: dto.metierId },
    });
    if (!metier) {
      throw new NotFoundException(`Metier ${dto.metierId} not found`);
    }

    await this.prisma.metierInteraction.upsert({
      where: {
        studentId_metierId: {
          studentId: student.id,
          metierId: dto.metierId,
        },
      },
      create: {
        studentId: student.id,
        metierId: dto.metierId,
        liked: dto.liked,
      },
      update: {
        liked: dto.liked,
      },
    });

    await this.recalculateFromInteractions(student.id);

    return {
      message: `Metier ${dto.liked ? 'liked' : 'disliked'} — recommendations updated`,
    };
  }

  async removeMetierInteraction(userId: string, metierId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new NotFoundException(`Student ${userId} not found`);
    }

    await this.prisma.metierInteraction.deleteMany({
      where: { studentId: student.id, metierId },
    });

    await this.recalculateFromInteractions(student.id);

    return { message: 'Interaction removed — recommendations updated' };
  }

  async getMetierInteractions(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) return [];

    const interactions = await this.prisma.metierInteraction.findMany({
      where: { studentId: student.id },
      include: { metier: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return interactions.map((i) => ({
      metierId: i.metierId,
      metierName: i.metier.name,
      liked: i.liked,
    }));
  }

  private static readonly ADJUSTMENT_FACTOR = 0.15; // Force de l'ajustement par interaction

  private async recalculateFromInteractions(studentId: string) {
    const studentDimensions = await this.prisma.studentDimension.findMany({
      where: { studentId },
    });

    const adjustedScores: Record<string, number> = {};
    for (const sd of studentDimensions) {
      adjustedScores[sd.dimensionId] = sd.normalizedScore;
    }

    const interactions = await this.prisma.metierInteraction.findMany({
      where: { studentId },
      include: {
        metier: {
          include: { dimensions: true },
        },
      },
    });

    const factor = MatchingService.ADJUSTMENT_FACTOR;
    for (const interaction of interactions) {
      const sign = interaction.liked ? 1 : -1;

      for (const mDim of interaction.metier.dimensions) {
        const current = adjustedScores[mDim.dimensionId] || 0;
        const adjusted = current + sign * factor * mDim.weight;
        adjustedScores[mDim.dimensionId] = Math.max(0, Math.min(1, adjusted));
      }
    }

    const domains = await this.prisma.domain.findMany({
      include: { dimensions: true },
    });

    const domainResults: { domainId: string; compatibility: number }[] = [];
    for (const domain of domains) {
      const weightSum = domain.dimensions.reduce((sum, d) => sum + d.weight, 0);
      let dotProduct = 0;
      for (const dDim of domain.dimensions) {
        dotProduct += (adjustedScores[dDim.dimensionId] || 0) * dDim.weight;
      }
      const compatibility =
        weightSum > 0 && Math.abs(weightSum - 1) > 0.01
          ? dotProduct / weightSum
          : dotProduct;

      domainResults.push({
        domainId: domain.id,
        compatibility: parseFloat((compatibility * 100).toFixed(1)),
      });
    }
    domainResults.sort((a, b) => b.compatibility - a.compatibility);

    const metiers = await this.prisma.metier.findMany({
      include: { dimensions: true },
    });

    const metierResults: { metierId: string; compatibility: number }[] = [];
    for (const metier of metiers) {
      const weightSum = metier.dimensions.reduce((sum, d) => sum + d.weight, 0);
      let dotProduct = 0;
      for (const mDim of metier.dimensions) {
        dotProduct += (adjustedScores[mDim.dimensionId] || 0) * mDim.weight;
      }
      const compatibility =
        weightSum > 0 && Math.abs(weightSum - 1) > 0.01
          ? dotProduct / weightSum
          : dotProduct;

      metierResults.push({
        metierId: metier.id,
        compatibility: parseFloat((compatibility * 100).toFixed(1)),
      });
    }
    metierResults.sort((a, b) => b.compatibility - a.compatibility);

    await this.prisma.result.deleteMany({ where: { studentId } });

    const resultData = [
      ...domainResults.slice(0, 5).map((r) => ({
        studentId,
        domainId: r.domainId,
        compatibility: r.compatibility,
      })),
      ...metierResults.slice(0, 10).map((r) => ({
        studentId,
        metierId: r.metierId,
        compatibility: r.compatibility,
      })),
    ];

    await this.prisma.result.createMany({ data: resultData });
  }
}
