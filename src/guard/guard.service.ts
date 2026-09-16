import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (request.path?.startsWith('/docs')) {
      return true
    }
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || apiKey !== process.env.APIKEY) {
      console.log('Acesso negado: x-api-key inválida ou ausente');
      return false;
    }

    return true;
  }
}
