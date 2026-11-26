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
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TipoUsuario } from '../common/enums/tipo-usuario.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CallerInfo } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateStatusDto, UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/change-password.dto';
import { UsersService } from './users.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Roles(TipoUsuario.ADMINISTRADOR)
@Controller('usuarios')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear usuario (Admin)' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary:
      'Listar usuarios. Admin: todos. Profesional/Tutor: solo lista profesionales.',
  })
  @ApiQuery({ name: 'tipo', enum: TipoUsuario, required: false })
  findAll(
    @CurrentUser() caller: CallerInfo,
    @Query('tipo') tipo?: TipoUsuario,
  ) {
    const tipoForzado = caller.esAdministrador ? tipo : TipoUsuario.PROFESIONAL;
    return this.usersService.findAll(tipoForzado);
  }

  @Get('me')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({
    summary: 'Obtener el perfil completo del usuario autenticado',
  })
  getMe(@CurrentUser() caller: CallerInfo) {
    return this.usersService.findMe(caller);
  }

  @Patch('me')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({
    summary:
      'Editar el perfil propio (nombre, apellido, email, teléfono, dirección)',
  })
  updateMe(@CurrentUser() caller: CallerInfo, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(dto, caller);
  }

  @Patch('me/password')
  @Roles(
    TipoUsuario.ADMINISTRADOR,
    TipoUsuario.PROFESIONAL,
    TipoUsuario.TUTOR,
    TipoUsuario.PCD,
  )
  @ApiOperation({
    summary:
      'Cambiar la contraseña propia (requiere la contraseña actual; cierra todas las sesiones)',
  })
  changeOwnPassword(
    @CurrentUser() caller: CallerInfo,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changeOwnPassword(caller, dto);
  }

  @Get(':id')
  @Roles(TipoUsuario.ADMINISTRADOR, TipoUsuario.PROFESIONAL, TipoUsuario.TUTOR)
  @ApiOperation({
    summary:
      'Ver usuario por ID (Admin: cualquiera; Profesional/Tutor: solo sus PCDs vinculados activos)',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: CallerInfo,
  ) {
    return this.usersService.findOne(id, caller);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modificar usuario (Admin)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar estado ACTIVO/INACTIVO (Admin)' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.usersService.updateStatus(id, dto);
  }

  @Patch(':id/password')
  @ApiOperation({
    summary:
      'Restablecer la contraseña de un usuario (Admin, no requiere la anterior)',
  })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.usersService.resetPassword(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario (Admin)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
