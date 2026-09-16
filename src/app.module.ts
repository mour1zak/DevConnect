import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { GuardModule } from './guard/guard.module';
import { ApiKeyGuard } from './guard/guard.service';
import { AdminModule } from './admin/admin.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptores/logging.interceptor';
import { ResponseInterceptor } from './common/interceptores/response.interceptor';
import { ExternalUsersModule } from './integrations/external-users/external-users.module';
import { PartnerModule } from './integrations/partner/partner.module';
import { ProfileClientModule } from './integrations/profile-client/profile-client.module';
import { NotificationClientModule } from './integrations/notification-client/notification-client.module';
import { envValidationsSchema } from './config/env.validation';

const nodeEnv = process.env.NODE_ENV ?? 'development'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envValidationsSchema, validationOptions: {
      allowUnknown: true,
      abortEarly: false,
    },
    envFilePath: nodeEnv === 'production' ? '.env.production' : '.env' }),
    AuthModule,
    UsersModule,
    PrismaModule,
    PostsModule,
    CommentsModule,
    GuardModule,
    AdminModule,
    ExternalUsersModule,
    PartnerModule,
    ProfileClientModule,
    NotificationClientModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // API Key exigida em TODA a aplicação.
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    {
  provide: APP_INTERCEPTOR,
  useClass: LoggingInterceptor,
},
{
  provide: APP_INTERCEPTOR,
  useClass: ResponseInterceptor,
},
  ],
})
export class AppModule {}
