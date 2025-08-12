import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Submission } from '../schema/Submission';
import { CreateSubmissionDto } from '../dto/submission/create-submission.dto';

@Injectable()
export class SubmissionService {
  constructor(@InjectModel(Submission.name) private submissionModel: Model<Submission>) {}

  async create(dto: CreateSubmissionDto, userId: string) {
    const created = await this.submissionModel.create({
      ...dto,
      user: userId,
    });
    return created;
  }

  async findByProblem(problemId: string) {
    return this.submissionModel.find({ problem: problemId }).populate('user', 'handle').exec();
  }

  async findByUser(userId: string) {
    return this.submissionModel.find({ user: userId }).populate('problem', 'title').exec();
  }

  async findOne(id: string, userId: string) {
    const submission = await this.submissionModel.findById(id).populate('user', 'handle').populate('problem', 'title');
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.user.toString() !== userId) throw new ForbiddenException('Access denied');
    return submission;
  }
}
