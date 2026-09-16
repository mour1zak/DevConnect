import { Module } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { PartnerController } from './partner.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';


@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.getOrThrow<string>('PARTNER_API_URL'),
        timeout: 5000,
        headers: {
          Authorization: `Bearer ${configService.getOrThrow<string>('PARTNER_API_TOKEN')}`,
        }
      })
      
    })
  ],
  providers: [PartnerService],
  controllers: [PartnerController]
})
export class PartnerModule {}
