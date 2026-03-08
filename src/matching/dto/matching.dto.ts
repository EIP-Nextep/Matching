export class CalculateDto {
  userId!: string;
  answers!: unknown[];
}

export class LikeDomainDto {
  userId!: string;
  domainId!: string;
}

export class LikeSchoolDto {
  userId!: string;
  schoolId!: string;
}
