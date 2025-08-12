import { Body, Controller, Get, Post, Param, UseGuards, Query } from '@nestjs/common';
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

  @Get()
  async findAll(@Query('publicOnly') publicOnly: string) {
    return this.problemService.findAll(publicOnly === 'true');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.problemService.findOne(id);
  }
}
