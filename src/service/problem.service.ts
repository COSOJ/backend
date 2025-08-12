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

  async findAll(publicOnly = true) {
    const filter = publicOnly ? { visibility: 'public' } : {};
    return this.problemModel.find(filter).exec();
  }

  async findOne(id: string) {
    const problem = await this.problemModel.findById(id);
    if (!problem || (problem.visibility !== 'public' && problem.visibility !== undefined)) {
      throw new NotFoundException('Problem not found or not public');
    }
    return problem;
  }
}
