import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthUser } from 'src/auth/interfaces/auth-user.interface';
import { Permission } from 'src/auth/enums/permission.enum';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { ApiSecurity } from '@nestjs/swagger';


@ApiSecurity('api-key')
@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}
  
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cria um post',
    description: 'Exige a permissão POST_CREATE.',
  })
  @ApiResponse({ status: 201, description: 'Post criado.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Usuário não possui a permissão POST_CREATE.' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.POST_CREATE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualiza um post próprio',
    description: 'Exige a permissão POST_UPDATE_OWN. O post precisa pertencer ao usuário autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Post atualizado.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Sem a permissão POST_UPDATE_OWN ou o post não pertence ao usuário.' })
  @ApiResponse({ status: 404, description: 'Post não encontrado.' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.POST_UPDATE_OWN)
  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, user.id, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove um post próprio',
    description: 'Exige a permissão POST_DELETE_OWN. O post precisa pertencer ao usuário autenticado.',
  })
  @ApiResponse({ status: 200, description: 'Post removido.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Sem a permissão POST_DELETE_OWN ou o post não pertence ao usuário.' })
  @ApiResponse({ status: 404, description: 'Post não encontrado.' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.POST_DELETE_OWN)
  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.remove(id, user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cria ou atualiza a reação do usuário em um post',
    description: 'Exige a permissão REACTION_CREATE.',
  })
  @ApiResponse({ status: 201, description: 'Reação registrada.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Usuário não possui a permissão REACTION_CREATE.' })
  @ApiResponse({ status: 404, description: 'Post não encontrado.' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.REACTION_CREATE)

  
  @Post(':postId/reactions')
  createReaction(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateReactionDto,
  ) {
    return this.postsService.upsertReaction(postId, user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.POST_UPDATE_ANY)
  @Put(':id/admin')
  adminUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
  return this.postsService.adminUpdate(id, dto);
  }


  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove um post (moderação)',
    description: 'Exige a permissão POST_DELETE_ANY. Não exige ser o dono do post.',
  })
  @ApiResponse({ status: 200, description: 'Post removido.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Usuário não possui a permissão POST_DELETE_ANY.' })
  @ApiResponse({ status: 404, description: 'Post não encontrado.' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.POST_DELETE_ANY)
  @Delete(':id/moderation')
  moderateDelete(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.moderateDelete(id)
  }
 }
