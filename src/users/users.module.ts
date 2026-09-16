import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './user.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProfileClientModule } from 'src/integrations/profile-client/profile-client.module';

@Module({
  imports: [PrismaModule, ProfileClientModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
