import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  providers: [MatchingService],
  controllers: [MatchingController],
})
export class MatchingModule {}
