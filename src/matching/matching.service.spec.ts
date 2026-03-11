import { Test, TestingModule } from '@nestjs/testing';
import { MatchingService } from './matching.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AnswerDto } from './dto/matching.dto';

interface StudentDimData {
  studentId: string;
  dimensionId: string;
  normalizedScore: number;
}

interface ResultData {
  studentId: string;
  domainId?: string;
  metierId?: string;
  compatibility: number;
}

function getCreateManyData<T>(mockFn: jest.Mock): T[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const raw = mockFn.mock.calls[0][0] as { data: T[] };
  return raw.data;
}

const mockPrisma = {
  question: { findMany: jest.fn() },
  studentProfile: { findUnique: jest.fn() },
  quizAnswer: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  option: { findMany: jest.fn() },
  dimension: { findUnique: jest.fn() },
  studentDimension: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  domain: { findMany: jest.fn() },
  metier: { findMany: jest.fn(), findUnique: jest.fn() },
  result: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  metierInteraction: {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  courseDomain: { findMany: jest.fn() },
};

describe('MatchingService', () => {
  let service: MatchingService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MatchingService>(MatchingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getQuestions', () => {
    it('should return questions with dimensions and options', async () => {
      const mockQuestions = [
        { id: 'q1', text: 'Question 1', dimension: { id: 'd1' }, options: [] },
      ];
      mockPrisma.question.findMany.mockResolvedValue(mockQuestions);

      const result = await service.getQuestions();

      expect(result).toEqual(mockQuestions);
      expect(mockPrisma.question.findMany).toHaveBeenCalledWith({
        include: { dimension: true, options: true },
      });
    });
  });

  describe('calculate', () => {
    const setupWriteMocks = () => {
      mockPrisma.quizAnswer.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.quizAnswer.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.studentDimension.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.studentDimension.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.result.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.result.createMany.mockResolvedValue({ count: 1 });
    };

    it('should throw NotFoundException if student not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.calculate({
          userId: 'unknown',
          answers: [{ questionId: 'q1', optionId: 'o1' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if answers are empty', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'user1',
      });

      await expect(
        service.calculate({ userId: 'user1', answers: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should delete old answers, insert new ones, then calculate', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'user1',
      });

      mockPrisma.quizAnswer.findMany.mockResolvedValue([
        { option: { dimensionName: 'Artistic' } },
        { option: { dimensionName: 'Artistic' } },
        { option: { dimensionName: 'Investigative' } },
      ]);

      mockPrisma.option.findMany.mockResolvedValue([
        { dimensionName: 'Artistic', questionId: 'q1' },
        { dimensionName: 'Artistic', questionId: 'q2' },
        { dimensionName: 'Artistic', questionId: 'q3' },
        { dimensionName: 'Investigative', questionId: 'q1' },
        { dimensionName: 'Investigative', questionId: 'q4' },
      ]);

      mockPrisma.dimension.findUnique
        .mockResolvedValueOnce({ id: 'dim-art', name: 'Artistic' })
        .mockResolvedValueOnce({ id: 'dim-inv', name: 'Investigative' });

      mockPrisma.domain.findMany.mockResolvedValue([
        {
          id: 'dom1',
          name: 'Arts & Design',
          dimensions: [
            { dimensionId: 'dim-art', weight: 0.7 },
            { dimensionId: 'dim-inv', weight: 0.3 },
          ],
        },
      ]);

      mockPrisma.metier.findMany.mockResolvedValue([
        {
          id: 'met1',
          name: 'Designer',
          dimensions: [
            { dimensionId: 'dim-art', weight: 0.8 },
            { dimensionId: 'dim-inv', weight: 0.2 },
          ],
        },
      ]);

      setupWriteMocks();

      const result = await service.calculate({
        userId: 'user1',
        answers: [
          { questionId: 'q1', optionId: 'o1' },
          { questionId: 'q2', optionId: 'o2' },
          { questionId: 'q3', optionId: 'o3' },
        ],
      });

      expect(result).toEqual({ message: 'Matching calculated successfully' });

      // Old answers deleted
      expect(mockPrisma.quizAnswer.deleteMany).toHaveBeenCalledWith({
        where: { studentId: 's1' },
      });
      // New answers inserted
      expect(mockPrisma.quizAnswer.createMany).toHaveBeenCalled();
      // Old dimensions deleted
      expect(mockPrisma.studentDimension.deleteMany).toHaveBeenCalledWith({
        where: { studentId: 's1' },
      });
    });

    it('should normalize scores correctly (rawScore / maxPossible)', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'user1',
      });

      mockPrisma.quizAnswer.findMany.mockResolvedValue([
        { option: { dimensionName: 'Artistic' } },
        { option: { dimensionName: 'Artistic' } },
        { option: { dimensionName: 'Investigative' } },
      ]);

      mockPrisma.option.findMany.mockResolvedValue([
        { dimensionName: 'Artistic', questionId: 'q1' },
        { dimensionName: 'Artistic', questionId: 'q2' },
        { dimensionName: 'Artistic', questionId: 'q3' },
        { dimensionName: 'Investigative', questionId: 'q1' },
        { dimensionName: 'Investigative', questionId: 'q4' },
      ]);

      mockPrisma.dimension.findUnique
        .mockResolvedValueOnce({ id: 'dim-art', name: 'Artistic' })
        .mockResolvedValueOnce({ id: 'dim-inv', name: 'Investigative' });

      mockPrisma.domain.findMany.mockResolvedValue([]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      setupWriteMocks();

      await service.calculate({
        userId: 'user1',
        answers: [
          { questionId: 'q1', optionId: 'o1' },
          { questionId: 'q2', optionId: 'o2' },
          { questionId: 'q3', optionId: 'o3' },
        ],
      });

      const dimData = getCreateManyData<StudentDimData>(
        mockPrisma.studentDimension.createMany,
      );
      expect(dimData).toHaveLength(2);

      // Artistic: rawScore=2, maxPossible=3 (distinct questions q1,q2,q3)
      const artDim = dimData.find((d) => d.dimensionId === 'dim-art')!;
      expect(artDim.normalizedScore).toBeCloseTo(2 / 3, 5);

      // Investigative: rawScore=1, maxPossible=2 (distinct questions q1,q4)
      const invDim = dimData.find((d) => d.dimensionId === 'dim-inv')!;
      expect(invDim.normalizedScore).toBeCloseTo(0.5, 5);
    });

    it('should compute correct dot-product domain compatibility', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });

      mockPrisma.quizAnswer.findMany.mockResolvedValue([
        { option: { dimensionName: 'Artistic' } },
      ]);

      mockPrisma.option.findMany.mockResolvedValue([
        { dimensionName: 'Artistic', questionId: 'q1' },
      ]);

      mockPrisma.dimension.findUnique.mockResolvedValue({
        id: 'dim-art',
        name: 'Artistic',
      });

      // Domain where Artistic weight = 1.0 (sum = 1)
      mockPrisma.domain.findMany.mockResolvedValue([
        {
          id: 'dom1',
          name: 'Arts',
          dimensions: [{ dimensionId: 'dim-art', weight: 1.0 }],
        },
      ]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      setupWriteMocks();

      await service.calculate({
        userId: 'u1',
        answers: [{ questionId: 'q1', optionId: 'o1' }],
      });

      // normalizedScore=1/1=1.0 → dotProduct=1.0*1.0=1.0 → 100%
      const resultData = getCreateManyData<ResultData>(
        mockPrisma.result.createMany,
      );
      const domainResult = resultData.find((r) => r.domainId === 'dom1')!;
      expect(domainResult.compatibility).toBe(100);
    });

    it('should normalize weights when they do not sum to 1', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });

      mockPrisma.quizAnswer.findMany.mockResolvedValue([
        { option: { dimensionName: 'A' } },
      ]);

      mockPrisma.option.findMany.mockResolvedValue([
        { dimensionName: 'A', questionId: 'q1' },
      ]);

      mockPrisma.dimension.findUnique.mockResolvedValue({
        id: 'dim-a',
        name: 'A',
      });

      // Weight sum = 2.0 → normalized → dotProduct / weightSum
      mockPrisma.domain.findMany.mockResolvedValue([
        {
          id: 'dom1',
          dimensions: [{ dimensionId: 'dim-a', weight: 2.0 }],
        },
      ]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      setupWriteMocks();

      await service.calculate({
        userId: 'u1',
        answers: [{ questionId: 'q1', optionId: 'o1' }],
      });

      // dotProduct = 1.0 * 2.0 = 2.0, weightSum = 2.0 → 2.0/2.0 = 1.0 → 100%
      const resultData = getCreateManyData<ResultData>(
        mockPrisma.result.createMany,
      );
      const domResult = resultData.find((r) => r.domainId === 'dom1')!;
      expect(domResult.compatibility).toBe(100);
    });

    it('should clamp normalized score to max 1', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });

      // 5 answers, but only 3 distinct questions → rawScore=5, maxPossible=3 → clamped to 1
      mockPrisma.quizAnswer.findMany.mockResolvedValue(
        Array(5).fill({ option: { dimensionName: 'X' } }),
      );

      mockPrisma.option.findMany.mockResolvedValue([
        { dimensionName: 'X', questionId: 'q1' },
        { dimensionName: 'X', questionId: 'q2' },
        { dimensionName: 'X', questionId: 'q3' },
      ]);

      mockPrisma.dimension.findUnique.mockResolvedValue({
        id: 'dim-x',
        name: 'X',
      });

      mockPrisma.domain.findMany.mockResolvedValue([]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      setupWriteMocks();

      await service.calculate({
        userId: 'u1',
        answers: Array.from(
          { length: 5 },
          (): AnswerDto => ({
            questionId: 'q1',
            optionId: 'o1',
          }),
        ),
      });

      const dimData = getCreateManyData<StudentDimData>(
        mockPrisma.studentDimension.createMany,
      );
      expect(dimData[0].normalizedScore).toBe(1);
    });

    it('should save top 5 domains and top 10 metiers', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.quizAnswer.findMany.mockResolvedValue([
        { option: { dimensionName: 'A' } },
      ]);
      mockPrisma.option.findMany.mockResolvedValue([
        { dimensionName: 'A', questionId: 'q1' },
      ]);
      mockPrisma.dimension.findUnique.mockResolvedValue({
        id: 'dim-a',
        name: 'A',
      });

      // 7 domains — only top 5 should be saved
      mockPrisma.domain.findMany.mockResolvedValue(
        Array.from({ length: 7 }, (_, i) => ({
          id: `dom${i}`,
          dimensions: [{ dimensionId: 'dim-a', weight: 1 }],
        })),
      );

      // 12 metiers — only top 10 should be saved
      mockPrisma.metier.findMany.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({
          id: `met${i}`,
          dimensions: [{ dimensionId: 'dim-a', weight: 1 }],
        })),
      );

      setupWriteMocks();

      await service.calculate({
        userId: 'u1',
        answers: [{ questionId: 'q1', optionId: 'o1' }],
      });

      const resultData = getCreateManyData<ResultData>(
        mockPrisma.result.createMany,
      );
      const domainResults = resultData.filter((r) => r.domainId);
      const metierResults = resultData.filter((r) => r.metierId);

      expect(domainResults).toHaveLength(5);
      expect(metierResults).toHaveLength(10);
    });
  });

  describe('getRecommendedDomains', () => {
    it('should return empty array if student not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue(null);
      const result = await service.getRecommendedDomains('unknown');
      expect(result).toEqual([]);
    });

    it('should return domains mapped from Result table', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.result.findMany.mockResolvedValue([
        {
          domainId: 'dom1',
          compatibility: 87.3,
          domain: { id: 'dom1', name: 'Informatique' },
        },
        {
          domainId: 'dom2',
          compatibility: 65.1,
          domain: { id: 'dom2', name: 'Santé' },
        },
      ]);

      const result = await service.getRecommendedDomains('u1');

      expect(result).toEqual([
        { id: 'dom1', name: 'Informatique', score: 87.3 },
        { id: 'dom2', name: 'Santé', score: 65.1 },
      ]);
    });
  });

  describe('getRecommendedMetiers', () => {
    it('should return empty array if student not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue(null);
      const result = await service.getRecommendedMetiers('unknown');
      expect(result).toEqual([]);
    });

    it('should return metiers with description, domain and topDimensions', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.result.findMany.mockResolvedValue([
        {
          metierId: 'met1',
          compatibility: 90.5,
          metier: {
            id: 'met1',
            name: 'Développeur',
            description: 'Crée des logiciels',
            domain: { name: 'Informatique' },
            dimensions: [
              { weight: 0.3, dimension: { name: 'Investigative' } },
              { weight: 0.25, dimension: { name: 'Innovation' } },
              { weight: 0.2, dimension: { name: 'Dependability' } },
            ],
          },
        },
      ]);

      const result = await service.getRecommendedMetiers('u1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'met1',
        name: 'Développeur',
        description: 'Crée des logiciels',
        domain: 'Informatique',
        score: 90.5,
        topDimensions: [
          { name: 'Investigative', weight: 30 },
          { name: 'Innovation', weight: 25 },
          { name: 'Dependability', weight: 20 },
        ],
      });
    });
  });

  describe('getRecommendedCourses', () => {
    it('should return empty array if student not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue(null);
      const result = await service.getRecommendedCourses('unknown');
      expect(result).toEqual([]);
    });

    it('should return empty array if no domain results', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.result.findMany.mockResolvedValue([]);
      const result = await service.getRecommendedCourses('u1');
      expect(result).toEqual([]);
    });

    it('should group courses by id and sort by best domain match', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.result.findMany.mockResolvedValue([
        { domainId: 'dom1', compatibility: 90 },
        { domainId: 'dom2', compatibility: 60 },
      ]);
      mockPrisma.courseDomain.findMany.mockResolvedValue([
        {
          courseId: 'crs1',
          domainId: 'dom1',
          course: {
            id: 'crs1',
          },
          domain: { name: 'Informatique' },
        },
        {
          courseId: 'crs2',
          domainId: 'dom2',
          course: {
            id: 'crs2',
          },
          domain: { name: 'Arts' },
        },
        {
          courseId: 'crs1',
          domainId: 'dom2',
          course: {
            id: 'crs1',
          },
          domain: { name: 'Arts' },
        },
      ]);

      const result = await service.getRecommendedCourses('u1');

      expect(result).toHaveLength(2);
      // crs1 first (bestMatch = 90)
      expect(result[0].id).toBe('crs1');
      expect(result[0].matchPercentage).toBe(90);
      expect(result[0].domains).toContain('Informatique');
      expect(result[0].domains).toContain('Arts');
      // crs2 second
      expect(result[1].id).toBe('crs2');
      expect(result[1].matchPercentage).toBe(60);
    });
  });

  describe('interactMetier', () => {
    it('should throw NotFoundException if student not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.interactMetier({
          userId: 'unknown',
          metierId: 'met1',
          liked: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if metier not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.metier.findUnique.mockResolvedValue(null);
      await expect(
        service.interactMetier({
          userId: 'u1',
          metierId: 'unknown',
          liked: true,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should upsert interaction, recalculate, and return liked message', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.metier.findUnique.mockResolvedValue({ id: 'met1' });
      mockPrisma.metierInteraction.upsert.mockResolvedValue({});

      // recalculate deps
      mockPrisma.studentDimension.findMany.mockResolvedValue([
        { dimensionId: 'dim1', normalizedScore: 0.5 },
      ]);
      mockPrisma.metierInteraction.findMany.mockResolvedValue([]);
      mockPrisma.domain.findMany.mockResolvedValue([]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      mockPrisma.result.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.result.createMany.mockResolvedValue({ count: 0 });

      const result = await service.interactMetier({
        userId: 'u1',
        metierId: 'met1',
        liked: true,
      });

      expect(result.message).toContain('liked');
      expect(mockPrisma.metierInteraction.upsert).toHaveBeenCalled();
    });

    it('should return disliked message when liked=false', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.metier.findUnique.mockResolvedValue({ id: 'met1' });
      mockPrisma.metierInteraction.upsert.mockResolvedValue({});
      mockPrisma.studentDimension.findMany.mockResolvedValue([]);
      mockPrisma.metierInteraction.findMany.mockResolvedValue([]);
      mockPrisma.domain.findMany.mockResolvedValue([]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      mockPrisma.result.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.result.createMany.mockResolvedValue({ count: 0 });

      const result = await service.interactMetier({
        userId: 'u1',
        metierId: 'met1',
        liked: false,
      });

      expect(result.message).toContain('disliked');
    });

    it('should adjust scores positively on like (ADJUSTMENT_FACTOR=0.15)', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.metier.findUnique.mockResolvedValue({ id: 'met1' });
      mockPrisma.metierInteraction.upsert.mockResolvedValue({});

      // Base score 0.5
      mockPrisma.studentDimension.findMany.mockResolvedValue([
        { dimensionId: 'dim1', normalizedScore: 0.5 },
      ]);

      // One like interaction → adjustedScore = 0.5 + 0.15*1.0 = 0.65
      mockPrisma.metierInteraction.findMany.mockResolvedValue([
        {
          liked: true,
          metier: { dimensions: [{ dimensionId: 'dim1', weight: 1.0 }] },
        },
      ]);

      mockPrisma.domain.findMany.mockResolvedValue([
        {
          id: 'dom1',
          dimensions: [{ dimensionId: 'dim1', weight: 1.0 }],
        },
      ]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      mockPrisma.result.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.result.createMany.mockResolvedValue({ count: 1 });

      await service.interactMetier({
        userId: 'u1',
        metierId: 'met1',
        liked: true,
      });

      // adjustedScore = 0.65 → domain compatibility 65%
      const resultData = getCreateManyData<ResultData>(
        mockPrisma.result.createMany,
      );
      const domResult = resultData.find((r) => r.domainId === 'dom1')!;
      expect(domResult.compatibility).toBe(65);
    });

    it('should clamp adjusted scores between 0 and 1', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.metier.findUnique.mockResolvedValue({ id: 'met1' });
      mockPrisma.metierInteraction.upsert.mockResolvedValue({});

      // Base score very high
      mockPrisma.studentDimension.findMany.mockResolvedValue([
        { dimensionId: 'dim1', normalizedScore: 0.95 },
      ]);

      // Like with weight 1.0 → 0.95 + 0.15*1.0 = 1.10 → clamped to 1.0
      mockPrisma.metierInteraction.findMany.mockResolvedValue([
        {
          liked: true,
          metier: { dimensions: [{ dimensionId: 'dim1', weight: 1.0 }] },
        },
      ]);

      mockPrisma.domain.findMany.mockResolvedValue([
        {
          id: 'dom1',
          dimensions: [{ dimensionId: 'dim1', weight: 1.0 }],
        },
      ]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      mockPrisma.result.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.result.createMany.mockResolvedValue({ count: 1 });

      await service.interactMetier({
        userId: 'u1',
        metierId: 'met1',
        liked: true,
      });

      // clamped to 1.0 → 100%
      const resultData = getCreateManyData<ResultData>(
        mockPrisma.result.createMany,
      );
      const domResult = resultData.find((r) => r.domainId === 'dom1')!;
      expect(domResult.compatibility).toBe(100);
    });
  });

  describe('removeMetierInteraction', () => {
    it('should throw NotFoundException if student not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue(null);
      await expect(
        service.removeMetierInteraction('unknown', 'met1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete interaction and recalculate', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.metierInteraction.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.studentDimension.findMany.mockResolvedValue([]);
      mockPrisma.metierInteraction.findMany.mockResolvedValue([]);
      mockPrisma.domain.findMany.mockResolvedValue([]);
      mockPrisma.metier.findMany.mockResolvedValue([]);
      mockPrisma.result.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.result.createMany.mockResolvedValue({ count: 0 });

      const result = await service.removeMetierInteraction('u1', 'met1');

      expect(result.message).toContain('removed');
      expect(mockPrisma.metierInteraction.deleteMany).toHaveBeenCalledWith({
        where: { studentId: 's1', metierId: 'met1' },
      });
    });
  });

  describe('getMetierInteractions', () => {
    it('should return empty array if student not found', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue(null);
      const result = await service.getMetierInteractions('unknown');
      expect(result).toEqual([]);
    });

    it('should return formatted list of interactions', async () => {
      mockPrisma.studentProfile.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
      });
      mockPrisma.metierInteraction.findMany.mockResolvedValue([
        {
          metierId: 'met1',
          liked: true,
          metier: { id: 'met1', name: 'Dev' },
        },
        {
          metierId: 'met2',
          liked: false,
          metier: { id: 'met2', name: 'Avocat' },
        },
      ]);

      const result = await service.getMetierInteractions('u1');

      expect(result).toEqual([
        { metierId: 'met1', metierName: 'Dev', liked: true },
        { metierId: 'met2', metierName: 'Avocat', liked: false },
      ]);
    });
  });
});
