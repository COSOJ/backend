import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, RootFilterQuery, Types, UpdateQuery } from 'mongoose';
import { Submission, SubmissionVerdict } from '../schema/Submission';
import {
  CreateSubmissionDto,
  SubmissionQueryDto,
} from '../dto/submission/create-submission.dto';
import { FileStorageService } from './file-storage.service';

export interface SubmissionListResponse {
  items: Submission[];
  total: number;
  current: number;
  pageSize: number;
  totalPages: number;
}

export interface SubmissionStatsResponse {
  totalSubmissions: number;
  verdictBreakdown: Array<{
    _id: SubmissionVerdict;
    count: number;
  }>;
}

type SubmissionOwner =
  | string
  | { _id?: Types.ObjectId | string; toString(): string };
type SubmissionAccessTarget = { user: SubmissionOwner };

@Injectable()
export class SubmissionService {
  constructor(
    @InjectModel(Submission.name) private submissionModel: Model<Submission>,
    private readonly fileStorageService: FileStorageService,
  ) {}

  /**
   * Check if user can view submission based on roles and ownership
   */
  private canViewSubmission(
    submission: SubmissionAccessTarget,
    userId: string,
    roles: string[] = [],
  ): boolean {
    const owner = submission.user;
    const ownerId =
      typeof owner === 'string'
        ? owner
        : owner._id
          ? owner._id.toString()
          : owner.toString();
    const isOwner = ownerId === userId;
    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    return isOwner || isAdmin;
  }

  /**
   * Create a new submission
   */
  async create(dto: CreateSubmissionDto, userId: string): Promise<Submission> {
    // Validate ObjectIds
    if (!Types.ObjectId.isValid(dto.problem)) {
      throw new BadRequestException('Invalid problem ID');
    }

    try {
      // Upload source code to file storage
      const uploadResult = await this.fileStorageService.uploadSubmissionFile(
        dto.code,
        dto.language,
        new Types.ObjectId().toString(), // Generate temporary ID for filename
      );

      const created = await this.submissionModel.create({
        user: userId,
        problem: dto.problem,
        language: dto.language,
        verdict: SubmissionVerdict.PENDING,
        timeUsedMs: 0,
        memoryUsedKb: 0,
        sourceFile: uploadResult.metadata,
        testCasesPassed: 0,
        totalTestCases: 0,
      });

      // Populate user and problem info for response
      const populatedSubmission = await this.submissionModel
        .findById(created._id)
        .populate('user', 'handle')
        .populate('problem', 'code title')
        .exec();

      if (!populatedSubmission) {
        // Clean up uploaded file if submission creation failed
        await this.fileStorageService.deleteFile(
          uploadResult.bucket,
          uploadResult.key,
        );
        throw new Error('Failed to create submission');
      }

      return populatedSubmission;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown submission error';
      throw new BadRequestException(`Failed to create submission: ${message}`);
    }
  }

  /**
   * Get submissions with filtering and pagination
   */
  async findAll(
    query: SubmissionQueryDto,
    requestUserId?: string,
    roles: string[] = [],
  ): Promise<SubmissionListResponse> {
    const {
      current = 1,
      pageSize = 10,
      user,
      problem,
      language,
      verdict,
    } = query;
    const skip = (current - 1) * pageSize;

    // Build filter
    const filter: RootFilterQuery<Submission> = {};
    if (user && Types.ObjectId.isValid(user)) filter.user = user;
    if (problem && Types.ObjectId.isValid(problem)) filter.problem = problem;
    if (language) filter.language = language;
    if (verdict) filter.verdict = verdict;

    const isAdmin = roles.includes('admin') || roles.includes('superadmin');

    // Non-admin users can only see their own submissions
    if (!isAdmin && requestUserId) {
      filter.user = requestUserId;
    }

    const [items, total] = await Promise.all([
      this.submissionModel
        .find(filter)
        .populate('user', 'handle')
        .populate('problem', 'code title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .exec(),
      this.submissionModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      current,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get submissions by problem with user filtering
   */
  async findByProblem(
    problemId: string,
    requestUserId?: string,
    roles: string[] = [],
  ): Promise<Submission[]> {
    if (!Types.ObjectId.isValid(problemId)) {
      throw new BadRequestException('Invalid problem ID');
    }

    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    const filter: RootFilterQuery<Submission> = { problem: problemId };

    // Non-admin users can only see their own submissions
    if (!isAdmin && requestUserId) {
      filter.user = requestUserId;
    }

    return this.submissionModel
      .find(filter)
      .populate('user', 'handle')
      .populate('problem', 'code title')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get submissions by user with access control
   */
  async findByUser(
    userId: string,
    requestUserId?: string,
    roles: string[] = [],
  ): Promise<Submission[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    const isOwner = userId === requestUserId;

    // Only admins and owners can view user submissions
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        "Access denied: Cannot view other users' submissions",
      );
    }

    return this.submissionModel
      .find({ user: userId })
      .populate('user', 'handle')
      .populate('problem', 'code title')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Get single submission with access control
   */
  async findOne(
    id: string,
    requestUserId?: string,
    roles: string[] = [],
  ): Promise<Submission> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid submission ID');
    }

    const submission = await this.submissionModel
      .findById(id)
      .populate('user', 'handle')
      .populate('problem', 'code title')
      .exec();

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    // Check access permissions
    if (!this.canViewSubmission(submission, requestUserId || '', roles)) {
      throw new ForbiddenException(
        'Access denied: Cannot view this submission',
      );
    }

    return submission;
  }

  /**
   * Get submission source code content
   */
  async getSourceCode(
    id: string,
    requestUserId?: string,
    roles: string[] = [],
  ): Promise<string> {
    const submission = await this.findOne(id, requestUserId, roles);

    try {
      const codeBuffer = await this.fileStorageService.getFile(
        submission.sourceFile.bucket,
        submission.sourceFile.key,
      );
      return codeBuffer.toString('utf-8');
    } catch {
      throw new NotFoundException('Source code file not found');
    }
  }

  /**
   * Update submission verdict (admin only)
   */
  async updateVerdict(
    id: string,
    verdict: SubmissionVerdict,
    timeUsedMs?: number,
    memoryUsedKb?: number,
    errorMessage?: string,
    testCasesPassed?: number,
    totalTestCases?: number,
    roles: string[] = [],
  ): Promise<Submission> {
    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    if (!isAdmin) {
      throw new ForbiddenException(
        'Access denied: Only admins can update verdicts',
      );
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid submission ID');
    }

    const updateData: UpdateQuery<Submission> = { verdict };
    if (timeUsedMs !== undefined) updateData.timeUsedMs = timeUsedMs;
    if (memoryUsedKb !== undefined) updateData.memoryUsedKb = memoryUsedKb;
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
    if (testCasesPassed !== undefined)
      updateData.testCasesPassed = testCasesPassed;
    if (totalTestCases !== undefined)
      updateData.totalTestCases = totalTestCases;

    const updated = await this.submissionModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('user', 'handle')
      .populate('problem', 'code title')
      .exec();

    if (!updated) {
      throw new NotFoundException('Submission not found');
    }

    return updated;
  }

  /**
   * Get submission statistics for a user
   */
  async getUserStats(
    userId: string,
    requestUserId?: string,
    roles: string[] = [],
  ): Promise<SubmissionStatsResponse> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    const isOwner = userId === requestUserId;

    // Only admins and owners can view stats
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        "Access denied: Cannot view other users' statistics",
      );
    }

    const stats = await this.submissionModel.aggregate<{
      _id: SubmissionVerdict;
      count: number;
    }>([
      { $match: { user: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$verdict',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalSubmissions = await this.submissionModel.countDocuments({
      user: userId,
    });

    return {
      totalSubmissions,
      verdictBreakdown: stats,
    };
  }
}
