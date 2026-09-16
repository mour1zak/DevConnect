import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  
  @ApiProperty({ description: 'Refresh token emitido no login', example: 'eyJhbGciOiJIUzI1NiIs...'})
  @IsString()
  @IsNotEmpty({ message: 'Informe o refresh token' })
  refresh_token!: string;
}
