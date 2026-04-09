import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guard/JwtAuthGuard';
import { OptionalJwtAuthGuard } from '../guard/OptionalJwtAuthGuard';
import { RolesGuard } from '../guard/RolesGuard';
import { Roles } from '../decorator/roles.decorator';
import { DisableCache } from '../decorator/no-cache.decorator';
import { SubmissionService } from '../service/submission.service';
import {
  CreateSubmissionDto,
  SubmissionQueryDto,
} from '../dto/submission/create-submission.dto';
import { SubmissionVerdict, ProgrammingLanguage } from '../schema/Submission';
import { Request } from 'express';

@Controller('submissions')
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @DisableCache()
  async create(@Body() dto: CreateSubmissionDto, @Req() req: Request) {
    const userId = req.user?.['_id'] || req.user?.['userId'];
    return this.submissionService.create(dto, userId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async findAll(
    @Query('current', new DefaultValuePipe(1), ParseIntPipe) current: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('user') user?: string,
    @Query('problem') problem?: string,
    @Query('language') languageParam?: string,
    @Query('verdict') verdict?: string,
    @Req() req?: Request,
  ) {
    const language = languageParam as ProgrammingLanguage | undefined;
    const query: SubmissionQueryDto = {
      current,
      pageSize,
      user,
      problem,
      language,
      verdict,
    };

    const userId = req?.user?.['_id'] || req?.user?.['userId'];
    const roles = req?.user?.['roles'] || [];

    return this.submissionService.findAll(query, userId, roles);
  }

  @Get('problem/:problemId')
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async findByProblem(
    @Param('problemId') problemId: string,
    @Req() req?: Request,
  ) {
    const userId = req?.user?.['_id'] || req?.user?.['userId'];
    const roles = req?.user?.['roles'] || [];
    return this.submissionService.findByProblem(problemId, userId, roles);
  }

  @Get('user/:userId')
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async findByUser(@Param('userId') userId: string, @Req() req?: Request) {
    const requestUserId = req?.user?.['_id'] || req?.user?.['userId'];
    const roles = req?.user?.['roles'] || [];
    return this.submissionService.findByUser(userId, requestUserId, roles);
  }

  @Get('user/:userId/stats')
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async getUserStats(@Param('userId') userId: string, @Req() req?: Request) {
    const requestUserId = req?.user?.['_id'] || req?.user?.['userId'];
    const roles = req?.user?.['roles'] || [];
    return this.submissionService.getUserStats(userId, requestUserId, roles);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async findOne(@Param('id') id: string, @Req() req?: Request) {
    const userId = req?.user?.['_id'] || req?.user?.['userId'];
    const roles = req?.user?.['roles'] || [];
    return this.submissionService.findOne(id, userId, roles);
  }

  @Put(':id/verdict')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @DisableCache()
  async updateVerdict(
    @Param('id') id: string,
    @Body()
    body: {
      verdict: SubmissionVerdict;
      timeUsedMs?: number;
      memoryUsedKb?: number;
      errorMessage?: string;
      testCasesPassed?: number;
      totalTestCases?: number;
    },
    @Req() req: Request,
  ) {
    const roles = req.user?.['roles'] || [];
    const {
      verdict,
      timeUsedMs,
      memoryUsedKb,
      errorMessage,
      testCasesPassed,
      totalTestCases,
    } = body;

    return this.submissionService.updateVerdict(
      id,
      verdict,
      timeUsedMs,
      memoryUsedKb,
      errorMessage,
      testCasesPassed,
      totalTestCases,
      roles,
    );
  }

  @Get(':id/source')
  @UseGuards(OptionalJwtAuthGuard)
  @DisableCache()
  async getSourceCode(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.['_id'] || req.user?.['userId'];
    const roles = req.user?.['roles'] || [];

    const sourceCode = await this.submissionService.getSourceCode(
      id,
      userId,
      roles,
    );
    return { sourceCode };
  }
}
