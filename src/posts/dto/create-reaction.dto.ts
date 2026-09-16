import { IsEnum } from 'class-validator';
import { ReactionType } from 'generated/prisma/enums';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReactionDto {
  @ApiProperty({ description: 'Tipo de reacao', enum: ReactionType, example: 'LIKE'})
  @IsEnum(ReactionType, { message: 'type deve ser LIKE ou DISLIKE' })
  type!: ReactionType;
}
