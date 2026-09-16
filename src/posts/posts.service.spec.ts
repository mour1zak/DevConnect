// Factory manual: evita carregar @nestjs/axios (pacote ESM) transitivamente via NotificationClientService.
jest.mock('src/integrations/notification-client/notification-client.service', () => ({
  NotificationClientService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationClientService } from 'src/integrations/notification-client/notification-client.service';

describe('PostsService', () => {
  let service: PostsService;
  let prisma: {
    post: { findUnique: jest.Mock };
    reaction: { upsert: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
  };
  let notificationClientService: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      post: { findUnique: jest.fn() },
      reaction: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    };
    notificationClientService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationClientService, useValue: notificationClientService },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upsertReaction', () => {
    it('não notifica quando o autor do post reage ao próprio post', async () => {
      const authorId = 1;
      const postId = 10;
      prisma.post.findUnique.mockResolvedValue({ id: postId, userId: authorId });
      prisma.reaction.upsert.mockResolvedValue({
        userId: authorId,
        postId,
        type: 'LIKE',
      });

      const result = await service.upsertReaction(postId, authorId, { type: 'LIKE' } as any);

      expect(prisma.reaction.upsert).toHaveBeenCalledWith({
        where: { userId_postId: { userId: authorId, postId } },
        create: { type: 'LIKE', userId: authorId, postId },
        update: { type: 'LIKE' },
      });
      expect(notificationClientService.create).not.toHaveBeenCalled();
      expect(result).toEqual({ userId: authorId, postId, type: 'LIKE' });
    });

    it('notifica o autor quando outro usuário curte o post', async () => {
      const authorId = 1;
      const otherUserId = 2;
      const postId = 10;
      prisma.post.findUnique.mockResolvedValue({ id: postId, userId: authorId });
      prisma.reaction.upsert.mockResolvedValue({
        userId: otherUserId,
        postId,
        type: 'LIKE',
      });

      await service.upsertReaction(postId, otherUserId, { type: 'LIKE' } as any);

      expect(notificationClientService.create).toHaveBeenCalledWith({
        userId: authorId,
        type: 'POST_LIKED',
        message: 'Seu post recebeu uma nova curtida',
      });
    });

    it('não notifica em reação do tipo DISLIKE, mesmo de outro usuário', async () => {
      const authorId = 1;
      const otherUserId = 2;
      const postId = 10;
      prisma.post.findUnique.mockResolvedValue({ id: postId, userId: authorId });
      prisma.reaction.upsert.mockResolvedValue({
        userId: otherUserId,
        postId,
        type: 'DISLIKE',
      });

      await service.upsertReaction(postId, otherUserId, { type: 'DISLIKE' } as any);

      expect(notificationClientService.create).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o post não existe', async () => {
      prisma.post.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertReaction(999, 1, { type: 'LIKE' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.reaction.upsert).not.toHaveBeenCalled();
      expect(notificationClientService.create).not.toHaveBeenCalled();
    });
  });
});
