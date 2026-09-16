import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProfileClientService } from 'src/integrations/profile-client/profile-client.service';

/**
 * Campos devolvidos ao cliente. `password` NUNCA entra aqui.
 */
const userSelect = {
  id: true,
  name: true,
  email: true,
  bio: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService,
    private readonly profileClientService: ProfileClientService,
  ) {}

  async create(dto: CreateUserDto) {
    const defaultRole = await this.prisma.role.findUnique({
      where: { name: 'USER' },
    });

    if (!defaultRole) {
      throw new InternalServerErrorException('Role padrão não configurada');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          bio: dto.bio,
          roleId: defaultRole.id,
        },
        select: userSelect,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.user.findMany({ select: userSelect });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
    if (!user) {
      throw new NotFoundException(`Usuário ${id} não encontrado`);
    }
    return user;
  }

  findByName(name: string) {
    return this.prisma.user.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      select: userSelect,
    });
  }

  /**
   * Uso interno da autenticação: aqui o `password` É retornado
   * porque o AuthService precisa comparar o hash.
   */
  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserPosts(userId: number) {
    await this.findOne(userId);
    return this.prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = { ...updateUserDto };
    if (updateUserDto.password) {
      data.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data,
        select: userSelect,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('E-mail já cadastrado');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  async updateAvatar(userId: number, Avatar: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { Avatar },
      select: {
        id: true,
        name: true,
        email: true,
        Avatar: true,
      }
    })
  }

  async findOneWithProfile(id: number) {
    const user = await this.findOne(id)
    const profile = await this.profileClientService.findByUserId(id)

    return {
      ...user,
      profile,
    }
  }
}
