import { IsEmail, IsNotEmpty,IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Nome de exibicao', example: 'Ada Lovelace'})
  @IsString()
  @IsNotEmpty({message: 'nome é obrigatorio' })
  name!: string;

  @ApiProperty({ description: 'E-Mail único do usuário', example: 'ada@devconnect.io'})
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Senha (minimo 6 caracteres', example: '**********', minLength: 6})
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ description: 'Bio curta do perfil', example: 'Matemática e computacao'})
  @IsOptional()
  @IsString()
  @IsNotEmpty({message: 'bio não pode ser vazia' })
  bio?: string;

}
