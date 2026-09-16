import { Module } from '@nestjs/common';
import { ExternalUsersService } from './external-users.service';
import { ExternalUsersController } from './external-users.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [ConfigModule, HttpModule.registerAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (ConfigService: ConfigService) => ({
      baseURL: ConfigService.getOrThrow<string>('EXTERNAL_USERS_API_URL'),
      timeout: 5000,
      maxRedirects: 5,
    })
  })],
  providers: [ExternalUsersService],
  controllers: [ExternalUsersController]
})
export class ExternalUsersModule {}
