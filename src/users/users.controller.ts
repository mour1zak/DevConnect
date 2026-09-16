import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './user.service';
import { ReplaceUserDto } from './dto/replace-user.dto';
import { NameValidationPipe } from 'src/common/pipes/name-validation.pipe';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger'
import { HttpStatus, ParseFilePipeBuilder } from '@nestjs/common';
import { avatarStorage } from 'src/common/upload/avatar-storage.config';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthUser } from 'src/auth/interfaces/auth-user.interface';

// A API Key é exigida globalmente (APP_GUARD em AppModule).
// O JWT é exigido apenas nas rotas que alteram dados.
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get('search/:name')
  searchByName(@Param('name', NameValidationPipe) name: string) {
    return this.usersService.findByName(name);
  }

  @Get(':id/posts')
  findUserPosts(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findUserPosts(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Get(':id/details')
  findOneWithProfile(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneWithProfile(id)
  }


  @UseGuards(JwtAuthGuard)
  @Put(':id')
  replace(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceUserDto,
  ) {
    this.ensureSelfOrAdmin(user, id);
    return this.usersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    this.ensureSelfOrAdmin(user, id);
    return this.usersService.update(id, updateUserDto);
  }

  /** O JWT só prova QUEM está logado — sem isso, qualquer usuário autenticado editava qualquer outro. */
  private ensureSelfOrAdmin(user: AuthUser, targetId: number) {
    if (user.id !== targetId && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Você só pode alterar o seu próprio usuário');
    }
  }

  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }


@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      avatar: {
        type: 'string',
        format: 'binary',
      },
    },
    required: ['avatar'],
  },
})
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiSecurity('api-key')
  @UseInterceptors(FileInterceptor('avatar', {
    storage: avatarStorage,
  }))
  uploadAvatar(@CurrentUser() user: AuthUser, 
  @UploadedFile(
    new ParseFilePipeBuilder()
      .addFileTypeValidator({
        fileType: /^image\/(jpeg|png)$/,
        skipMagicNumbersValidation: true,
      })
      .addMaxSizeValidator({
        maxSize: 2 * 1024 * 1024,
      })
      .build({
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
  ) file: Express.Multer.File) {
    const avatarPath = `/uploads/avatars/${file.filename}`
    return this.usersService.updateAvatar(user.id, avatarPath)
  }
}
