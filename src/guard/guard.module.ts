import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './guard.service';

@Module({
  providers: [ApiKeyGuard],
  exports: [ApiKeyGuard],
})
export class GuardModule {}
