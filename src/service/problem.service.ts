import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { Problem } from '../schema/Problem';
import { CreateProblemDto } from '../dto/problem/create-problem.dto';

@Injectable()
export class ProblemService {
  constructor(
    @InjectModel(Problem.name) private problemModel: Model<Problem>,
  ) {}

  /**
   * Check if user roles allow viewing private problems
   */
  private canViewPrivate(roles: string[]): boolean {
    return roles.includes('admin') || roles.includes('superadmin');
  }

  /**
   * Get MongoDB projection/aggregation pipeline for test cases based on user permissions
   * Filters test cases at database level for better performance
   */
  private getTestCaseProjection(
    roles: string[],
  ): PipelineStage.AddFields | null {
    const isAdmin = this.canViewPrivate(roles);

    if (isAdmin) {
      // Admins see all test cases - no filtering needed
      return null;
    }

    // Regular users only see public test cases - filter at DB level
    return {
      $addFields: {
        cases: {
          $filter: {
            input: '$cases',
            cond: { $eq: ['$$this.isPublic', true] },
          },
        },
      },
    };
  }

  async create(dto: CreateProblemDto) {
    const created = await this.problemModel.create({
      ...dto,
      visibility: dto.visibility ?? 'private',
    });
    return created;
  }

  async findAll(
    current: number = 1,
    pageSize: number = 5,
    roles: string[] = [],
  ) {
    const skip = (current - 1) * pageSize;
    const isAdmin = this.canViewPrivate(roles);

    // Build aggregation pipeline
    const pipeline: PipelineStage[] = [
      // Match phase: filter by visibility
      {
        $match: isAdmin ? {} : { visibility: 'public' },
      },
    ];

    // Add test case filtering for non-admin users
    const testCaseProjection = this.getTestCaseProjection(roles);
    if (testCaseProjection) {
      pipeline.push(testCaseProjection);
    }

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: pageSize });

    // Execute aggregation and count in parallel
    const [items, total] = await Promise.all([
      this.problemModel.aggregate<Problem>(pipeline).exec(),
      this.problemModel.countDocuments(isAdmin ? {} : { visibility: 'public' }),
    ]);

    return {
      items,
      total,
      current,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, roles: string[] = []) {
    const isAdmin = this.canViewPrivate(roles);

    // Build aggregation pipeline for single document
    const pipeline: PipelineStage[] = [
      {
        $match: { _id: new Types.ObjectId(id) },
      },
    ];

    // Add test case filtering for non-admin users
    const testCaseProjection = this.getTestCaseProjection(roles);
    if (testCaseProjection) {
      pipeline.push(testCaseProjection);
    }

    const results = await this.problemModel.aggregate<Problem>(pipeline).exec();
    const problem = results[0];

    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    // Check visibility permissions
    if (problem.visibility !== 'public' && !isAdmin) {
      throw new NotFoundException(
        "You don't have permission to view this problem",
      );
    }

    return problem;
  }

  async update(id: string, dto: CreateProblemDto) {
    const updated = await this.problemModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      throw new NotFoundException('Problem not found');
    }
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.problemModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException('Problem not found');
    }
    return deleted;
  }

  /**
   * Administrative method to get complete problem data without filtering
   * Used for problem management and editing - requires admin privileges
   */
  async findOneComplete(id: string, roles: string[] = []) {
    if (!this.canViewPrivate(roles)) {
      throw new NotFoundException(
        'Insufficient permissions to access complete problem data',
      );
    }

    const problem = await this.problemModel.findById(id);
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }

    return problem;
  }
}
