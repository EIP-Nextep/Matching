import { ApiProperty } from '@nestjs/swagger';

export class AnswerDto {
  @ApiProperty({ description: 'ID de la question', example: 'uuid-question' })
  questionId!: string;

  @ApiProperty({
    description: "ID de l'option choisie",
    example: 'uuid-option',
  })
  optionId!: string;
}

export class CalculateDto {
  @ApiProperty({ description: 'ID utilisateur', example: 'test-user-1' })
  userId!: string;

  @ApiProperty({
    description: 'Liste des réponses au quiz (une par question)',
    type: [AnswerDto],
  })
  answers!: AnswerDto[];
}

export class MetierInteractionDto {
  @ApiProperty({ description: 'ID utilisateur', example: 'test-user-1' })
  userId!: string;

  @ApiProperty({ description: 'ID du métier', example: 'uuid-metier' })
  metierId!: string;

  @ApiProperty({ description: 'true = like, false = dislike', example: true })
  liked!: boolean;
}

export class RemoveInteractionDto {
  @ApiProperty({ description: 'ID utilisateur', example: 'test-user-1' })
  userId!: string;

  @ApiProperty({ description: 'ID du métier', example: 'uuid-metier' })
  metierId!: string;
}

export class CreateUserDto {
  @ApiProperty({
    description: 'ID utilisateur (venant du microservice Auth)',
    example: 'auth-user-uuid',
  })
  userId!: string;
}
