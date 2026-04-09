import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Logger,
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { FileStorageService } from '../service/file-storage.service';
import { SubmissionService } from '../service/submission.service';
import { ProblemService } from '../service/problem.service';
import { OptionalJwtAuthGuard } from '../guard/OptionalJwtAuthGuard';
import { RolesGuard } from '../guard/RolesGuard';
import { CurrentUser } from '../decorator/current-user.decorator';
import { User } from '../schema/User';

type SubmissionAccessTarget = {
  user: string | { toString(): string };
};

@Controller('files')
@UseGuards(OptionalJwtAuthGuard, RolesGuard)
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly submissionService: SubmissionService,
    private readonly problemService: ProblemService,
  ) {}

  /**
   * Get submission source code file
   * Access control: Users can access their own submissions, admins can access all
   */
  @Get('submissions/:submissionId/source')
  async getSubmissionSource(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: User | undefined,
    @Res() res: Response,
  ) {
    try {
      const submission = await this.submissionService.findOne(
        submissionId,
        user?._id,
        user?.roles || [],
      );
      if (!submission) {
        throw new NotFoundException('Submission not found');
      }

      // Check access permissions
      if (!this.canAccessSubmission(submission, user)) {
        throw new ForbiddenException('Access denied to this submission');
      }

      const fileStream = await this.fileStorageService.getFileStream(
        submission.sourceFile.bucket,
        submission.sourceFile.key,
      );

      res.setHeader('Content-Type', submission.sourceFile.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${submission.sourceFile.originalName}"`,
      );
      res.setHeader('Cache-Control', 'private, max-age=3600');

      fileStream.pipe(res);
    } catch (error) {
      this.logger.error(
        `Failed to get submission source for ${submissionId}`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to retrieve file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get problem test case input file
   * Access control: Public test cases for all, private test cases for admins only
   */
  @Get('problems/:problemId/test-cases/:index/input')
  async getTestCaseInput(
    @Param('problemId') problemId: string,
    @Param('index') index: string,
    @CurrentUser() user: User | undefined,
    @Res() res: Response,
  ) {
    try {
      const problem = await this.problemService.findOne(
        problemId,
        user?.roles || [],
      );
      if (!problem) {
        throw new NotFoundException('Problem not found');
      }

      const testCaseIndex = parseInt(index, 10);
      if (testCaseIndex < 0 || testCaseIndex >= problem.cases.length) {
        throw new NotFoundException('Test case not found');
      }

      const testCase = problem.cases[testCaseIndex];

      // Check access permissions
      if (!testCase.isPublic && !this.isAdminUser(user)) {
        throw new ForbiddenException('Access denied to private test case');
      }

      // Handle both file reference and legacy string storage
      let content: string;
      let filename: string;

      if (testCase.inputFile) {
        const fileBuffer = await this.fileStorageService.getFile(
          testCase.inputFile.bucket,
          testCase.inputFile.key,
        );
        content = fileBuffer.toString('utf-8');
        filename = testCase.inputFile.originalName;
      } else if (testCase.input) {
        content = testCase.input;
        filename = `${problem.code}-test-${testCaseIndex}-input.txt`;
      } else {
        throw new NotFoundException('Test case input not available');
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(content);
    } catch (error) {
      this.logger.error(
        `Failed to get test case input for ${problemId}:${index}`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to retrieve file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get problem test case output file
   * Access control: Public test cases for all, private test cases for admins only
   */
  @Get('problems/:problemId/test-cases/:index/output')
  async getTestCaseOutput(
    @Param('problemId') problemId: string,
    @Param('index') index: string,
    @CurrentUser() user: User | undefined,
    @Res() res: Response,
  ) {
    try {
      const problem = await this.problemService.findOne(
        problemId,
        user?.roles || [],
      );
      if (!problem) {
        throw new NotFoundException('Problem not found');
      }

      const testCaseIndex = parseInt(index, 10);
      if (testCaseIndex < 0 || testCaseIndex >= problem.cases.length) {
        throw new NotFoundException('Test case not found');
      }

      const testCase = problem.cases[testCaseIndex];

      // Check access permissions
      if (!testCase.isPublic && !this.isAdminUser(user)) {
        throw new ForbiddenException('Access denied to private test case');
      }

      // Handle both file reference and legacy string storage
      let content: string;
      let filename: string;

      if (testCase.outputFile) {
        const fileBuffer = await this.fileStorageService.getFile(
          testCase.outputFile.bucket,
          testCase.outputFile.key,
        );
        content = fileBuffer.toString('utf-8');
        filename = testCase.outputFile.originalName;
      } else if (testCase.output) {
        content = testCase.output;
        filename = `${problem.code}-test-${testCaseIndex}-output.txt`;
      } else {
        throw new NotFoundException('Test case output not available');
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(content);
    } catch (error) {
      this.logger.error(
        `Failed to get test case output for ${problemId}:${index}`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to retrieve file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Download submission source code as attachment
   */
  @Get('submissions/:submissionId/download')
  async downloadSubmissionSource(
    @Param('submissionId') submissionId: string,
    @CurrentUser() user: User | undefined,
    @Res() res: Response,
  ) {
    try {
      const submission = await this.submissionService.findOne(
        submissionId,
        user?._id,
        user?.roles || [],
      );
      if (!submission) {
        throw new NotFoundException('Submission not found');
      }

      // Check access permissions
      if (!this.canAccessSubmission(submission, user)) {
        throw new ForbiddenException('Access denied to this submission');
      }

      const fileStream = await this.fileStorageService.getFileStream(
        submission.sourceFile.bucket,
        submission.sourceFile.key,
      );

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${submission.sourceFile.originalName}"`,
      );

      fileStream.pipe(res);
    } catch (error) {
      this.logger.error(
        `Failed to download submission source for ${submissionId}`,
        error,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to download file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check if user can access a submission
   */
  private canAccessSubmission(
    submission: SubmissionAccessTarget,
    user: User | undefined,
  ): boolean {
    if (!user) {
      return false; // No access for anonymous users
    }

    // Users can access their own submissions
    const submissionUserId =
      typeof submission.user === 'string'
        ? submission.user
        : submission.user.toString();
    if (submissionUserId === user._id.toString()) {
      return true;
    }

    // Admins can access all submissions
    return this.isAdminUser(user);
  }

  /**
   * Check if user is admin
   */
  private isAdminUser(user: User | undefined): boolean {
    return (
      user?.roles?.includes('admin') ||
      user?.roles?.includes('superadmin') ||
      false
    );
  }
}
