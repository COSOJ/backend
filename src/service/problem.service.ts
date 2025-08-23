import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Problem } from '../schema/Problem';
import { CreateProblemDto } from '../dto/problem/create-problem.dto';

@Injectable()
export class ProblemService {
  constructor(@InjectModel(Problem.name) private problemModel: Model<Problem>) {}

  async create(dto: CreateProblemDto) {
    const created = await this.problemModel.create({
      ...dto,
      visibility: dto.visibility ?? 'private',
    });
    return created;
  }

  async findAll(current: number = 1, pageSize: number = 5) {
    const filter = { visibility: 'public' };
    const skip = (current - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.problemModel.find(filter).skip(skip).limit(pageSize).exec(),
      this.problemModel.countDocuments(filter),
    ]);
    return {
      items,
      total,
      current,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string) {
    const problem = await this.problemModel.findById(id);
    if (!problem || (problem.visibility !== 'public' && problem.visibility !== undefined)) {
      throw new NotFoundException('Problem not found or not public');
    }
    return problem;
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
