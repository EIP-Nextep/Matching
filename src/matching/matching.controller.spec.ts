import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

const mockService = {
  createUser: jest.fn(),
  getQuestions: jest.fn(),
  calculate: jest.fn(),
  getRecommendedDomains: jest.fn(),
  getRecommendedMetiers: jest.fn(),
  getRecommendedCourses: jest.fn(),
  interactMetier: jest.fn(),
  removeMetierInteraction: jest.fn(),
  getMetierInteractions: jest.fn(),
};

describe('MatchingController', () => {
  let controller: MatchingController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [MatchingController],
      providers: [{ provide: MatchingService, useValue: mockService }],
    }).compile();

    controller = module.get<MatchingController>(MatchingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUser', () => {
    it('should delegate to matchingService.createUser(userId)', async () => {
      const dto = { userId: 'u1' };
      const expected = {
        message: 'User created in matching service',
        user: { id: 'uuid', userId: 'u1' },
      };
      mockService.createUser.mockResolvedValue(expected);

      const result = await controller.createUser(dto);

      expect(result).toEqual(expected);
      expect(mockService.createUser).toHaveBeenCalledWith('u1');
    });
  });

  describe('getQuestions', () => {
    it('should delegate to matchingService.getQuestions()', async () => {
      const expected = [{ id: 'q1', text: 'Question' }];
      mockService.getQuestions.mockResolvedValue(expected);

      const result = await controller.getQuestions();

      expect(result).toEqual(expected);
      expect(mockService.getQuestions).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculate', () => {
    it('should delegate to matchingService.calculate(dto)', async () => {
      const dto = {
        userId: 'u1',
        answers: [{ questionId: 'q1', optionId: 'o1' }],
      };
      const expected = { message: 'Matching calculated successfully' };
      mockService.calculate.mockResolvedValue(expected);

      const result = await controller.calculate(dto);

      expect(result).toEqual(expected);
      expect(mockService.calculate).toHaveBeenCalledWith(dto);
    });
  });

  describe('getRecommendedDomains', () => {
    it('should delegate with userId param', async () => {
      const expected = [{ id: 'dom1', name: 'Info', score: 87 }];
      mockService.getRecommendedDomains.mockResolvedValue(expected);

      const result = await controller.getRecommendedDomains('u1');

      expect(result).toEqual(expected);
      expect(mockService.getRecommendedDomains).toHaveBeenCalledWith('u1');
    });
  });

  describe('getRecommendedMetiers', () => {
    it('should delegate with userId param', async () => {
      const expected = [{ id: 'met1', name: 'Dev', score: 90 }];
      mockService.getRecommendedMetiers.mockResolvedValue(expected);

      const result = await controller.getRecommendedMetiers('u1');

      expect(result).toEqual(expected);
      expect(mockService.getRecommendedMetiers).toHaveBeenCalledWith('u1');
    });
  });

  describe('getRecommendedCourses', () => {
    it('should delegate with userId param', async () => {
      const expected = [
        { id: 'crs1', matchPercentage: 90, domains: ['Informatique'] },
      ];
      mockService.getRecommendedCourses.mockResolvedValue(expected);

      const result = await controller.getRecommendedCourses('u1');

      expect(result).toEqual(expected);
      expect(mockService.getRecommendedCourses).toHaveBeenCalledWith('u1');
    });
  });

  describe('interactMetier', () => {
    it('should delegate dto to matchingService.interactMetier()', async () => {
      const dto = { userId: 'u1', metierId: 'met1', liked: true };
      const expected = { message: 'Metier liked — recommendations updated' };
      mockService.interactMetier.mockResolvedValue(expected);

      const result = await controller.interactMetier(dto);

      expect(result).toEqual(expected);
      expect(mockService.interactMetier).toHaveBeenCalledWith(dto);
    });
  });

  describe('removeMetierInteraction', () => {
    it('should delegate userId and metierId', async () => {
      const dto = { userId: 'u1', metierId: 'met1' };
      const expected = { message: 'Interaction removed' };
      mockService.removeMetierInteraction.mockResolvedValue(expected);

      const result = await controller.removeMetierInteraction(dto);

      expect(result).toEqual(expected);
      expect(mockService.removeMetierInteraction).toHaveBeenCalledWith(
        'u1',
        'met1',
      );
    });
  });

  describe('getMetierInteractions', () => {
    it('should delegate with userId param', async () => {
      const expected = [{ metierId: 'met1', metierName: 'Dev', liked: true }];
      mockService.getMetierInteractions.mockResolvedValue(expected);

      const result = await controller.getMetierInteractions('u1');

      expect(result).toEqual(expected);
      expect(mockService.getMetierInteractions).toHaveBeenCalledWith('u1');
    });
  });
});
