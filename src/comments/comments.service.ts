import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationClientService } from 'src/integrations/notification-client/notification-client.service';

const authorPreview = { select: { id: true, name: true } } as const;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService,
    private readonly notificationClientService: NotificationClientService,
  ) {}

  async create(postId: number, userId: number, dto: CreateCommentDto) {
    const post = await this.ensurePostExists(postId)

    const comment = await this.prisma.comment.create({
      data: { text: dto.text, postId, userId},
      include: { user: authorPreview },
    })

    if (post.userId !== userId) {
      await this.notificationClientService.create({
        userId: post.userId,
        type: 'NEW_COMMENT',
        message: 'Seu post recebeu um novo comentário'
      })
    }

    return comment
  }



  async findAllByPost(postId: number) {
    await this.ensurePostExists(postId);
    return this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: { user: authorPreview },
    });
  }

  async findOne(postId: number, commentId: number) {
    return this.getScoped(postId, commentId);
  }

  async update(
    postId: number,
    commentId: number,
    userId: number,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.getScoped(postId, commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Você não é o autor deste comentário');
    }
    return this.prisma.comment.update({
      where: { id: commentId },
      data: dto,
      include: { user: authorPreview },
    });
  }

  async remove(postId: number, commentId: number, userId: number) {
    const comment = await this.getScoped(postId, commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException('Você não é o autor deste comentário');
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { deleted: true };
  }

  /** Remoção por MODERATOR/ADMIN: não exige ser o autor do comentário. */
  async moderateDelete(postId: number, commentId: number) {
    await this.getScoped(postId, commentId);
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { deleted: true };
  }

  private async ensurePostExists(postId: number) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(`Post ${postId} não encontrado`);
    }
    return post;
  }

  private async getScoped(postId: number, commentId: number) {
    await this.ensurePostExists(postId);
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.postId !== postId) {
      throw new NotFoundException(`Comentário ${commentId} não encontrado`);
    }
    return comment;
  }

    async userUpdate(postId: number, commentId: number, userId: number, dto: UpdateCommentDto) {
    await this.ensureOwner(postId, commentId, userId)
    return this.prisma.comment.update({
      where: { id: commentId },
      data: dto,
      include: { user: authorPreview}
    })
  }

  private async ensureOwner(postId: number, commentId: number, userId: number) {
    const comment = await this.getScoped(postId, commentId)
    if (comment.userId !== userId) {
      throw new ForbiddenException('Você não é o dono deste comentátio')
    }
    return comment
  }
}
