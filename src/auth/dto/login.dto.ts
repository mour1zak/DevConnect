import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description:'Email-cadastrado', example: 'ada@devconnect.io'})
  @IsString()
  @IsNotEmpty({message: 'Insira seu email'})
  @IsEmail()
  email!: string;

  @ApiProperty({description: 'Senha do usuário', example: '*********'})
  @IsString()
  @IsNotEmpty({ message: 'Insira sua senha' })
  password!: string;
}