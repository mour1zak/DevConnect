import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationClientModule } from 'src/integrations/notification-client/notification-client.module';

@Module({
  imports: [PrismaModule, NotificationClientModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
