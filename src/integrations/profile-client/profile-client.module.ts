import { Module } from '@nestjs/common';
import { ProfileClientService } from './profile-client.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';


@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (ConfigService: ConfigService) => ({
        baseURL: ConfigService.getOrThrow<string>('PROFILE_SERVICE_URL'),
        timeout: 3000,
        maxRedirects: 5,
      }),
    }),
  ],
  providers: [ProfileClientService],
  exports: [ ProfileClientService]
})
export class ProfileClientModule {}
