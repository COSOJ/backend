import { Body, Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../guard/JwtAuthGuard';
import { SubmissionService } from '../service/submission.service';
import { CreateSubmissionDto } from '../dto/submission/create-submission.dto';
import { Request } from 'express';

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateSubmissionDto, @Req() req: Request) {
    // @ts-ignore
    return this.submissionService.create(dto, req.user.userId);
  }

  @Get('problem/:problemId')
  async findByProblem(@Param('problemId') problemId: string) {
    return this.submissionService.findByProblem(problemId);
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.submissionService.findByUser(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req: Request) {
    // @ts-ignore
    return this.submissionService.findOne(id, req.user.userId);
  }
}
