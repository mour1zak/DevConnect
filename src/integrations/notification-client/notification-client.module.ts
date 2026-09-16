import { Module } from '@nestjs/common';
import { NotificationClientService } from './notification-client.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (ConfigService: ConfigService) => ({
        baseURL: ConfigService.getOrThrow<string>('NOTIFICATION_SERVICE_URL'),
        timeout: 3000,
        maxRedirects: 5,
      }),
    }),
  ],
  providers: [NotificationClientService],
  exports: [NotificationClientService]
})
export class NotificationClientModule {}
