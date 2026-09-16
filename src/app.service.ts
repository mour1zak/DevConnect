import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

const authorPreview = { select: { id: true, name: true } } as const;

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World MODIFICADO2132!';
  }

  /** Feed: posts mais recentes primeiro, com autor e contagens. */
  feed() {
    return this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: authorPreview,
        _count: { select: { comments: true, reactions: true } },
      },
    });
  }

  /** Estatísticas gerais da rede social. */
  async stats() {
    const [users, posts, comments, reactions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.comment.count(),
      this.prisma.reaction.count(),
    ]);
    return { users, posts, comments, reactions };
  }
}
