import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationClientModule } from 'src/integrations/notification-client/notification-client.module';


@Module({
  imports: [PrismaModule, NotificationClientModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
