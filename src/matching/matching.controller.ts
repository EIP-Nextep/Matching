import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MatchingService } from './matching.service';
import { CalculateDto, LikeDomainDto, LikeSchoolDto } from './dto/matching.dto';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get('questions')
  getQuestions() {
    return this.matchingService.getQuestions();
  }

  @Post('calculate')
  calculate(@Body() calculateDto: CalculateDto) {
    return this.matchingService.calculate(calculateDto);
  }

  @Get('recommendations/domains/:userId')
  getRecommendedDomains(@Param('userId') userId: string) {
    return this.matchingService.getRecommendedDomains(userId);
  }

  @Get('recommendations/schools/:userId')
  getRecommendedSchools(@Param('userId') userId: string) {
    return this.matchingService.getRecommendedSchools(userId);
  }

  @Post('interactions/like-domain')
  likeDomain(@Body() likeDomainDto: LikeDomainDto) {
    return this.matchingService.likeDomain(likeDomainDto);
  }

  @Post('interactions/like-school')
  likeSchool(@Body() likeSchoolDto: LikeSchoolDto) {
    return this.matchingService.likeSchool(likeSchoolDto);
  }
}
