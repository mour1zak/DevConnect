import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthUser } from 'src/auth/interfaces/auth-user.interface';
import { Role } from 'src/auth/enums/role.enum';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Permissions } from 'src/auth/decorators/permissions.decorator';
import { Permission } from 'src/auth/enums/permission.enum';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { ApiSecurity } from '@nestjs/swagger';


@ApiSecurity('api-key')
@ApiTags('comments')
@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, user.id, dto);
  }

  @Get()
  findAll(@Param('postId', ParseIntPipe) postId: number) {
    return this.commentsService.findAllByPost(postId);
  }

  @Get(':commentId')
  findOne(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.commentsService.findOne(postId, commentId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':commentId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(postId, commentId, user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.COMMENT_UPDATE_OWN)
  @Put(':commentId')
  userUpdate(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return  this.commentsService.userUpdate(postId, commentId, user.id, dto)
  }





  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove um comentário (moderação)',
    description: 'Exige a permissão COMMENT_DELETE_ANY. Não exige ser o autor do comentário.',
  })
  @ApiResponse({ status: 200, description: 'Comentário removido.' })
  @ApiResponse({ status: 401, description: 'JWT ausente ou inválido.' })
  @ApiResponse({ status: 403, description: 'Usuário não possui a permissão COMMENT_DELETE_ANY.' })
  @ApiResponse({ status: 404, description: 'Comentário não encontrado.' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.COMMENT_DELETE_ANY)
  @Delete(':commentId/moderation')
  moderateDelete(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.commentsService.moderateDelete(postId, commentId);
  }
}
