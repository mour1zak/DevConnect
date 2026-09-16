import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  
  @ApiProperty({description: 'Conteudo do comentário', example: 'Muito bom esse post!'})
  @IsString()
  @IsNotEmpty({ message: 'O texto do comentário é obrigatório' })
  text!: string;
}
