import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthUser } from './interfaces/auth-user.interface';
import { ApiOperation, ApiResponse, ApiBearerAuth} from '@nestjs/swagger';
import { ApiSecurity } from '@nestjs/swagger';


@ApiTags('auth')
@ApiSecurity('api-key')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
  
  @Post('refresh')
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refresh_token);
  }
  
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Request() req: any) {
    return req.user;
  }



  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retorna o usuário autenticado e suas permissões'
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil autenticado',
  })
  @ApiResponse({
    status: 401,
    description: 'JWT inválido ou ausente',
  })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return user;
  }
}