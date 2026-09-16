import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('CommentsService', () => {
  let service: CommentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentsService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
