import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { MatchingService } from './matching.service';
import {
  CalculateDto,
  MetierInteractionDto,
  RemoveInteractionDto,
  CreateUserDto,
  CreateCourseDto,
} from './dto/matching.dto';
import { AuthGuard } from '../app.guard';

@ApiTags('matching')
@UseGuards(AuthGuard)
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post('user')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Créer un profil étudiant vierge pour un nouvel utilisateur',
  })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé (ou déjà existant)',
  })
  createUser(@Body() dto: CreateUserDto) {
    return this.matchingService.createUser(dto.userId);
  }

  @Get('questions')
  @ApiOperation({
    summary: 'Récupérer toutes les questions du quiz avec leurs options',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des questions avec dimensions et options',
  })
  getQuestions() {
    return this.matchingService.getQuestions();
  }

  @Post('calculate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Calculer le matching à partir des réponses au quiz',
  })
  @ApiResponse({ status: 200, description: 'Matching calculé avec succès' })
  @ApiResponse({ status: 404, description: 'Étudiant non trouvé' })
  @ApiResponse({ status: 400, description: 'Aucune réponse fournie' })
  calculate(@Body() calculateDto: CalculateDto) {
    return this.matchingService.calculate(calculateDto);
  }

  @Get('recommendations/domains/:userId')
  @ApiOperation({ summary: 'Obtenir les domaines recommandés (top 5)' })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description: 'Liste des domaines avec score de compatibilité',
  })
  getRecommendedDomains(@Param('userId') userId: string) {
    return this.matchingService.getRecommendedDomains(userId);
  }

  @Get('recommendations/metiers/:userId')
  @ApiOperation({
    summary:
      'Obtenir les métiers recommandés (top 10) avec description et dimensions',
  })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description:
      'Liste des métiers avec score, description, domaine et top dimensions',
  })
  getRecommendedMetiers(@Param('userId') userId: string) {
    return this.matchingService.getRecommendedMetiers(userId);
  }

  @Get('recommendations/courses/:userId')
  @ApiOperation({
    summary: 'Obtenir les parcours recommandés triés par meilleur domaine',
  })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description:
      'Liste des parcours avec pourcentage de match et domaines couverts',
  })
  getRecommendedCourses(@Param('userId') userId: string) {
    return this.matchingService.getRecommendedCourses(userId);
  }

  @Post('interactions/metier')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Liker ou disliker un métier (recalcule les recommandations)',
  })
  @ApiResponse({
    status: 200,
    description: 'Interaction enregistrée, recommandations mises à jour',
  })
  @ApiResponse({ status: 404, description: 'Étudiant ou métier non trouvé' })
  interactMetier(@Body() dto: MetierInteractionDto) {
    return this.matchingService.interactMetier(dto);
  }

  @Delete('interactions/metier')
  @ApiOperation({
    summary:
      'Supprimer une interaction sur un métier (recalcule les recommandations)',
  })
  @ApiResponse({
    status: 200,
    description: 'Interaction supprimée, recommandations recalculées',
  })
  @ApiResponse({ status: 404, description: 'Étudiant non trouvé' })
  removeMetierInteraction(@Body() dto: RemoveInteractionDto) {
    return this.matchingService.removeMetierInteraction(
      dto.userId,
      dto.metierId,
    );
  }

  @Get('interactions/metiers/:userId')
  @ApiOperation({
    summary: "Lister toutes les interactions (likes/dislikes) d'un utilisateur",
  })
  @ApiParam({ name: 'userId', description: "ID de l'utilisateur" })
  @ApiResponse({
    status: 200,
    description:
      'Liste des interactions avec nom du métier et statut like/dislike',
  })
  getMetierInteractions(@Param('userId') userId: string) {
    return this.matchingService.getMetierInteractions(userId);
  }

  @Post('courses')
  @HttpCode(201)
  @ApiOperation({ summary: 'Ajouter un parcours dans la base de données' })
  @ApiResponse({
    status: 201,
    description: 'Le parcours a été ajouté avec succès',
  })
  createCourse(@Body() dto: CreateCourseDto) {
    return this.matchingService.createCourse(dto);
  }
}
