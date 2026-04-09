import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  UseGuards,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guard/JwtAuthGuard';
import { OptionalJwtAuthGuard } from '../guard/OptionalJwtAuthGuard';
import { ProblemService } from '../service/problem.service';
import { RolesGuard } from '../guard/RolesGuard';
import { Roles } from '../decorator/roles.decorator';
import { DisableCache } from '../decorator/no-cache.decorator';
import { CreateProblemDto } from '../dto/problem/create-problem.dto';
import { Request } from 'express';

@Controller('problems')
export class ProblemController {
  constructor(private readonly problemService: ProblemService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async create(@Body() dto: CreateProblemDto) {
    return this.problemService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async update(@Param('id') id: string, @Body() dto: CreateProblemDto) {
    return this.problemService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async delete(@Param('id') id: string) {
    return this.problemService.delete(id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async findAll(
    @Query('current', new DefaultValuePipe(1), ParseIntPipe) current: number,
    @Query('pageSize', new DefaultValuePipe(5), ParseIntPipe) pageSize: number,
    @Req() req: Request,
  ) {
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    return this.problemService.findAll(current, pageSize, roles);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async findOne(@Param('id') id: string, @Req() req: Request) {
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    return this.problemService.findOne(id, roles);
  }
}
