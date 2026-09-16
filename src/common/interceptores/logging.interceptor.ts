import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, originalUrl } = request;
    const userId = request.user?.id ?? request.user?.sub ?? 'anonymous';

    const start = Date.now();

    this.logger.log(
      `→ ${method} ${originalUrl} user=${userId}`,
    );

    return next.handle().pipe(
      finalize(() => {
        const duration = Date.now() - start;

        this.logger.log(
          `← ${method} ${originalUrl} ${response.statusCode} ${duration}ms user=${userId}`,
        );
      }),
    );
  }
}