import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { NotificationClientService } from 'src/integrations/notification-client/notification-client.service';

/** Só id e nome do autor aparecem nos relacionamentos. Sem `password`. */
const authorPreview = { select: { id: true, name: true } } as const;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService,
    private readonly notificationClientService: NotificationClientService,
  ) {}

  async create(userId: number, dto: CreatePostDto) {
    return this.prisma.post.create({
      data: { text: dto.text, userId },
      include: { user: authorPreview },
    });
  }

  findAll() {
    return this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: authorPreview },
    });
  }

  async findOne(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        user: authorPreview,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: authorPreview },
        },
        reactions: {
          include: { user: authorPreview },
        },
      },
    });
    if (!post) {
      throw new NotFoundException(`Post ${id} não encontrado`);
    }
    return post;
  }

  async update(id: number, userId: number, dto: UpdatePostDto) {
    await this.ensureOwner(id, userId);
    return this.prisma.post.update({
      where: { id },
      data: dto,
      include: { user: authorPreview },
    });
  }

  async remove(id: number, userId: number) {
    await this.ensureOwner(id, userId);
    await this.prisma.post.delete({ where: { id } });
    return { deleted: true };
  }

  /** Remoção por MODERATOR/ADMIN: não exige ser o dono do post. */
  async moderateDelete(id: number) {
    await this.ensureExists(id);
    await this.prisma.post.delete({ where: { id } });
    return { deleted: true };
  }

  /** Atualização por MODERATOR/ADMIN: não exige ser o dono do post. */
  async moderateUpdate(id: number, dto: UpdatePostDto) {
    await this.ensureExists(id);
    return this.prisma.post.update({
      where: { id },
      data: dto,
      include: { user: authorPreview },
    });
  }

  async upsertReaction(postId: number, userId: number, dto: CreateReactionDto) {
    const post = await this.ensureExists(postId)

    const reaction = await this.prisma.reaction.upsert({
      where: { userId_postId: { userId, postId} },
      create: { type: dto.type, userId, postId},
      update: { type: dto.type },
    })

    if (dto.type === 'LIKE' && post.userId !== userId) {
      await this.notificationClientService.create({
        userId: post.userId,
        type: 'POST_LIKED',
        message: 'Seu post recebeu uma nova curtida'
      }) 
    }
    return reaction;
  }

  async removeReaction(postId: number, userId: number) {
    await this.ensureExists(postId);
    const reaction = await this.prisma.reaction.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!reaction) {
      throw new NotFoundException('Reação não encontrada');
    }
    await this.prisma.reaction.delete({
      where: { userId_postId: { userId, postId } },
    });
    return { deleted: true };
  }

  private async ensureExists(id: number) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw new NotFoundException(`Post ${id} não encontrado`);
    }
    return post;
  }

  private async ensureOwner(id: number, userId: number) {
    const post = await this.ensureExists(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('Você não é o dono deste post');
    }
    return post;
  }

  async adminUpdate(id: number, dto: UpdatePostDto) {
  await this.ensureExists(id)
  return this.prisma.post.update({
    where: { id },
    data: dto,
    include: { user: authorPreview}
  })
}

}

