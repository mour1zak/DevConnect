import { Injectable,  UnauthorizedException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs'
import { UsersService } from 'src/users/user.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser (email: string, password: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) {
        return null
    }

    const senhaValida = await bcrypt.compare(password, user.password)
    if (!senhaValida) {
        return null
    }
    
    const { password: _senha, ...resto } = user
    return resto
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password)
    if (!user) {
        throw new UnauthorizedException('Credenciais inválidas')
    }
    if (user.roleId == null) {
        throw new UnauthorizedException('Usuário sem role atribuída')
    }

    return this.generateTokens({ sub: user.id, email: user.email, roleId: user.roleId })
  }

  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado')
    }

    const user = await this.usersService.findByEmail(payload.email)
    if (!user || user.roleId == null) {
        throw new UnauthorizedException('Refresh token inválido ou expirado')
    }

    const newPayload: JwtPayload = { sub: user.id, email: user.email, roleId: user.roleId }
    return this.generateTokens(newPayload)
  }

  private async generateTokens(payload: JwtPayload) {
    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ||
          '7d') as NonNullable<JwtSignOptions['expiresIn']>,
      }),
    ])

    return { access_token, refresh_token }
  }
}