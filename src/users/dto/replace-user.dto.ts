import { IsEmail, IsNotEmpty, IsOptional, IsString, } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ReplaceUserDto {
    @ApiProperty({description: 'Nome é obrigatorio', example: 'Maria'})
    @IsString()
    @IsNotEmpty({ message: 'nome é obrigatorio'})
    name!: string

    @ApiProperty({ description: 'Email único do usuario', example: 'maria@devconnect.io'})
    @IsEmail()
    email!: string

    @ApiPropertyOptional({description: 'bio é opcional', example: 'Amo animais'})
    @IsOptional()
    @IsString()
    @IsNotEmpty({ message: 'bio não pode ser vazia' })
    bio?: string
 }