import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { Role } from 'src/auth/enums/role.enum';


export class UpdateUserRoleDto {
  @ApiProperty({
    enum: Role,
    example: Role.MODERATOR,
  })
  @IsEnum(Role)
  role!: Role;
}