import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ExternalUsersService } from './external-users.service';
import { CreateExternalPostDto } from './dto/create-external-post.dto';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { Permission } from '../../auth/enums/permission.enum';

@ApiTags('User Externo')
@Controller('external-users')
export class ExternalUsersController {
  constructor(private readonly externalUsersService: ExternalUsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.EXTERNAL_USERS_VIEW)
  findAll() {
    return this.externalUsersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.EXTERNAL_USERS_VIEW)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.externalUsersService.findOne(id)
  }

  @Get(':userId/posts')
  findPostsByUser(@Param('userId', ParseIntPipe) userId: number) {
    return this.externalUsersService.findPostsByUser(userId)
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.EXTERNAL_POST_CREATE)
  createPOst(@Body() dto: CreateExternalPostDto) {
    return this.externalUsersService.createPost(dto)
  }
}