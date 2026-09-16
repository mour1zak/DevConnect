import {
  IsArray,
  IsInt,
} from 'class-validator';

import {
  ApiProperty,
} from '@nestjs/swagger';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    example: [1, 2, 4, 7],
  })
  @IsArray()
  @IsInt({
    each: true,
  })
  permissionIds!: number[];
}