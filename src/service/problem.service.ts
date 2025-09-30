import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Problem } from '../schema/Problem';
import { CreateProblemDto } from '../dto/problem/create-problem.dto';

@Injectable()
export class ProblemService {
  constructor(@InjectModel(Problem.name) private problemModel: Model<Problem>) {}

  /**
   * Check if user roles allow viewing private problems
   */
  private canViewPrivate(roles: string[]): boolean {
    return roles.includes('admin') || roles.includes('superadmin');
  }

  /**
   * Filter test cases based on user permissions
   * Non-admin users only see public test cases
   */
  private filterTestCases(problem: any, roles: string[]): any {
    if (!problem.cases) return problem;
    
    const isAdmin = this.canViewPrivate(roles);
    if (isAdmin) {
      // Admins see all test cases
      return problem;
    }
    
    // Regular users only see public test cases
    const filteredProblem = { ...problem };
    filteredProblem.cases = problem.cases.filter((testCase: any) => testCase.isPublic);
    return filteredProblem;
  }

  async create(dto: CreateProblemDto) {
    const created = await this.problemModel.create({
      ...dto,
      visibility: dto.visibility ?? 'private',
    });
    return created;
  }

  async findAll(current: number = 1, pageSize: number = 5, roles: string[] = []) {
    let filter = { visibility: 'public' } as {};
    if (this.canViewPrivate(roles)) {
      filter = {};
    }
    const skip = (current - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.problemModel.find(filter).skip(skip).limit(pageSize).exec(),
      this.problemModel.countDocuments(filter),
    ]);
    
    // Filter test cases for each problem based on user permissions
    const filteredItems = items.map(problem => 
      this.filterTestCases(problem.toObject(), roles)
    );
    
    return {
      items: filteredItems,
      total,
      current,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, roles: string[] = []) {
    const problem = await this.problemModel.findById(id);
    if (!problem) {
      throw new NotFoundException('Problem not found');
    }
    
    // Use consistent role checking method
    if (problem.visibility !== 'public' && !this.canViewPrivate(roles)) {
      throw new NotFoundException('You don\'t have permission to view this problem');
    }
    
    // Filter test cases based on user permissions
    return this.filterTestCases(problem.toObject(), roles);
  }

  async update(id: string, dto: CreateProblemDto) {
    const updated = await this.problemModel.findByIdAndUpdate(id, dto, { new: true });
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
}
