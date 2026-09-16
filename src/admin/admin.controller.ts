import {
  Controller,
  Get,
  Patch,
  Put,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-admin.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { Permission } from 'src/auth/enums/permission.enum';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';


@ApiTags('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Permissions(
    Permission.USER_LIST,
  )
  @ApiOperation({
    summary: 'Lista todos os usuários',
    description: 'Exige a permissão USER_LIST.',
  })
  @ApiResponse({ status: 200, description: 'Lista de usuários retornada com sucesso.' })
  @ApiResponse({ status: 401, description: 'Token de autenticação ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Usuário autenticado não possui a permissão USER_LIST.' })
  findAllUsers() {
    return this.adminService.findAllUsers();
  }



  @Patch('users/:id/role')
  @Permissions(
    Permission.USER_CHANGE_ROLE,
  )
  @ApiOperation({
    summary: 'Atualiza a role de um usuário',
    description: 'PATCH /admin/users/{id}/role — altera a role do usuário informado no path. Exige a permissão USER_CHANGE_ROLE.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    required: true,
    description: 'ID numérico do usuário cujo papel será alterado.',
    example: 42,
  })
  @ApiResponse({ status: 200, description: 'Role atualizada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Parâmetro id inválido ou role inválida no corpo da requisição.' })
  @ApiResponse({ status: 401, description: 'Token de autenticação ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Usuário autenticado não possui a permissão USER_CHANGE_ROLE.' })
  @ApiResponse({ status: 404, description: 'Usuário não encontrado.' })
  updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(Number(id), dto.role);
  }

  @Get('roles')
@Permissions(
  Permission.ROLE_PERMISSION_VIEW,
)
findAllRoles() {
  return this.adminService.findAllRoles();
}

@Get('permissions')
@Permissions(
  Permission.ROLE_PERMISSION_VIEW,
)
findAllPermissions() {
  return this.adminService.findAllPermissions();
}

@Get('roles/:id/permissions')
@Permissions(
  Permission.ROLE_PERMISSION_VIEW,
)
findRolePermissions(
  @Param('id', ParseIntPipe)
  id: number,
) {
  return this.adminService.findRolePermissions(id);
}

@Put('roles/:id/permissions')
@Permissions(
  Permission.ROLE_PERMISSION_UPDATE,
)
updateRolePermissions(
  @Param('id', ParseIntPipe)
  id: number,

  @Body()
  dto: UpdateRolePermissionsDto,
) {
  return this.adminService.updateRolePermissions(
    id,
    dto.permissionIds,
  );
}
}
