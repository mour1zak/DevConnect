import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import { Role } from '../enums/role.enum';

import {
  ROLES_KEY,
} from '../decorators/roles.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class RolesGuard
  implements CanActivate {

  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {

    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!requiredRoles) {
      return true;
    }

    const request =
      context.switchToHttp().getRequest();

    const user = request.user as AuthUser
    if(!user) {
        return false
    }

    return requiredRoles.includes(user.role as Role)
  }
}