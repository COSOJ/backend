import { Body, Controller, Get, Post, Put, Delete, Param, UseGuards, Query, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../guard/JwtAuthGuard';
import { ProblemService } from 'src/service/problem.service';
import { RolesGuard } from 'src/guard/RolesGuard';
import { Roles } from 'src/decorator/roles.decorator';
import { CreateProblemDto } from 'src/dto/problem/create-problem.dto';

@Controller('problems')
export class ProblemController {
  constructor(private readonly problemService: ProblemService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateProblemDto) {
    return this.problemService.create(dto);
  }


  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: CreateProblemDto) {
    return this.problemService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async delete(@Param('id') id: string) {
    return this.problemService.delete(id);
  }

  @Get()
  async findAll(@Query('current') current: number = 1, @Query('pageSize') pageSize: number = 5) {
    return await this.problemService.findAll(current, pageSize);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.problemService.findOne(id);
  }
}
