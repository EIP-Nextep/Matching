import { Injectable } from '@nestjs/common';
import { CalculateDto, LikeDomainDto, LikeSchoolDto } from './dto/matching.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MatchingService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuestions() {
    return this.prisma.question.findMany({
      include: {
        dimension: true,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  calculate(_calculateDto: CalculateDto) {
    return {
      status: 'success',
      message: 'Calcul mocké',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getRecommendedDomains(_userId: string) {
    return [
      { id: 'd1', name: 'Informatique', score: 95 },
      { id: 'd2', name: 'Design', score: 80 },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getRecommendedSchools(_userId: string) {
    return [
      { id: 's1', name: 'Epitech', location: 'Paris', matchPercentage: 98 },
      { id: 's2', name: 'Beaux-Arts', location: 'Lyon', matchPercentage: 85 },
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  likeDomain(_likeDomainDto: LikeDomainDto) {
    return {
      status: 'success',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  likeSchool(_likeSchoolDto: LikeSchoolDto) {
    return {
      status: 'success',
    };
  }
}
