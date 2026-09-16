import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Extrai o usuário autenticado que a JwtStrategy anexou em `request.user`.
 *
 * Uso:
 *   create(@CurrentUser() user: AuthUser) { ... }        -> objeto completo
 *   create(@CurrentUser('id') userId: number) { ... }     -> apenas um campo
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
