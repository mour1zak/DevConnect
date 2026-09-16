import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Role } from 'src/auth/enums/role.enum';

/** Campos devolvidos ao cliente. `password` NUNCA entra aqui. */
const userSelect = {
  id: true,
  name: true,
  bio: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllUsers() {
    return this.prisma.user.findMany({ select: userSelect });
  }

  async updateUserRole(id: number, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuário ${id} não encontrado`);
    }

    const roleRef = await this.prisma.role.findUnique({ where: { name: role } });
    if (!roleRef) {
      throw new InternalServerErrorException(`Role ${role} não configurada`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { role, roleId: roleRef.id },
      select: userSelect,
    });
  }

  findAllRoles() {
  return this.prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
}

findAllPermissions() {
  return this.prisma.permission.findMany({
    select: {
      id: true,
      code: true,
      description: true,
    },
    orderBy: {
      code: 'asc',
    },
  });
}

async findRolePermissions(roleId: number) {
  const role = await this.prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundException('Role não encontrada');
  }

  const rolePermissions = await this.prisma.rolePermission.findMany({
    where: { roleId },
    select: {
      permission: {
        select: {
          id: true,
          code: true,
          description: true,
        },
      },
    },
    orderBy: {
      permission: {
        code: 'asc',
      },
    },
  });

  return rolePermissions.map((rp) => rp.permission);
}

async updateRolePermissions(
  roleId: number,
  permissionIds: number[],
) {

  const role =
    await this.prisma.role.findUnique({
      where: {
        id: roleId,
      },
    });

  if (!role) {
    throw new NotFoundException(
      'Role não encontrada',
    );
  }

  const uniquePermissionIds =
    [...new Set(permissionIds)];

  const permissions =
    await this.prisma.permission.findMany({
      where: {
        id: {
          in: uniquePermissionIds,
        },
      },
    });

  if (
    permissions.length !==
    uniquePermissionIds.length
  ) {
    throw new BadRequestException(
      'Uma ou mais permissions são inválidas',
    );
  }

  if (role.name === 'ADMIN') {
  const requiredCodes = [
    'ROLE_PERMISSION_VIEW',
    'ROLE_PERMISSION_UPDATE',
  ];

  const selectedCodes =
    permissions.map(
      permission =>
        permission.code,
    );

  const missing =
    requiredCodes.filter(
      code =>
        !selectedCodes.includes(code),
    );

  if (missing.length > 0) {
    throw new BadRequestException(
      'ADMIN deve manter as permissões de administração de acessos',
    );
  }
}

  await this.prisma.$transaction(
    async tx => {

      await tx.rolePermission.deleteMany({
        where: {
          roleId,
        },
      });

      if (uniquePermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data:
            uniquePermissionIds.map(
              permissionId => ({
                roleId,
                permissionId,
              }),
            ),
        });
      }
    },
  );

  return this.findRolePermissions(roleId);
}


}
