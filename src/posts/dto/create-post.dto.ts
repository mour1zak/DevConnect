import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ description: 'Conteúdo do post', example: 'Hoje aprendi sobre RBAC no NestJS!' })
  @IsString()
  @IsNotEmpty({ message: 'Texto do post não pode ser vazio' })
  text!: string;
}
