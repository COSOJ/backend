import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Submission, SubmissionVerdict } from '../schema/Submission';
import { CreateSubmissionDto, SubmissionQueryDto } from '../dto/submission/create-submission.dto';

export interface SubmissionListResponse {
  items: Submission[];
  total: number;
  current: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class SubmissionService {
  constructor(@InjectModel(Submission.name) private submissionModel: Model<Submission>) {}

  /**
   * Check if user can view submission based on roles and ownership
   */
  private canViewSubmission(submission: any, userId: string, roles: string[] = []): boolean {
    const isOwner = submission.user._id?.toString() === userId || submission.user.toString() === userId;
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

    const created = await this.submissionModel.create({
      ...dto,
      user: userId,
      verdict: SubmissionVerdict.PENDING,
      timeUsedMs: 0,
      memoryUsedKb: 0,
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
      throw new Error('Failed to create submission');
    }

    return populatedSubmission;
  }

  /**
   * Get submissions with filtering and pagination
   */
  async findAll(query: SubmissionQueryDto, requestUserId?: string, roles: string[] = []): Promise<SubmissionListResponse> {
    const { current = 1, pageSize = 10, user, problem, language, verdict } = query;
    const skip = (current - 1) * pageSize;

    // Build filter
    const filter: any = {};
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
  async findByProblem(problemId: string, requestUserId?: string, roles: string[] = []): Promise<Submission[]> {
    if (!Types.ObjectId.isValid(problemId)) {
      throw new BadRequestException('Invalid problem ID');
    }

    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    const filter: any = { problem: problemId };

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
  async findByUser(userId: string, requestUserId?: string, roles: string[] = []): Promise<Submission[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    const isOwner = userId === requestUserId;

    // Only admins and owners can view user submissions
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Access denied: Cannot view other users\' submissions');
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
  async findOne(id: string, requestUserId?: string, roles: string[] = []): Promise<Submission> {
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
      throw new ForbiddenException('Access denied: Cannot view this submission');
    }

    return submission;
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
    roles: string[] = []
  ): Promise<Submission> {
    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    if (!isAdmin) {
      throw new ForbiddenException('Access denied: Only admins can update verdicts');
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid submission ID');
    }

    const updateData: any = { verdict };
    if (timeUsedMs !== undefined) updateData.timeUsedMs = timeUsedMs;
    if (memoryUsedKb !== undefined) updateData.memoryUsedKb = memoryUsedKb;
    if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
    if (testCasesPassed !== undefined) updateData.testCasesPassed = testCasesPassed;
    if (totalTestCases !== undefined) updateData.totalTestCases = totalTestCases;

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
  async getUserStats(userId: string, requestUserId?: string, roles: string[] = []): Promise<any> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const isAdmin = roles.includes('admin') || roles.includes('superadmin');
    const isOwner = userId === requestUserId;

    // Only admins and owners can view stats
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('Access denied: Cannot view other users\' statistics');
    }

    const stats = await this.submissionModel.aggregate([
      { $match: { user: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$verdict',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalSubmissions = await this.submissionModel.countDocuments({ user: userId });
    
    return {
      totalSubmissions,
      verdictBreakdown: stats,
    };
  }
}
