import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum SubmissionVerdict {
  PENDING = 'pending',
  ACCEPTED = 'accepted', 
  WRONG_ANSWER = 'wrong_answer',
  TIME_LIMIT_EXCEEDED = 'time_limit_exceeded',
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  RUNTIME_ERROR = 'runtime_error',
  COMPILATION_ERROR = 'compilation_error',
  SYSTEM_ERROR = 'system_error'
}

export enum ProgrammingLanguage {
  CPP = 'cpp',
  JAVA = 'java',
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  C = 'c'
}

@Schema({ timestamps: true })
export class Submission extends Document<string> {
  @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
  user: string;

  @Prop({ type: 'ObjectId', ref: 'Problem', required: true, index: true })
  problem: string;

  @Prop({ type: String, enum: Object.values(ProgrammingLanguage), required: true, index: true })
  language: ProgrammingLanguage;
  
  @Prop({ type: String, enum: Object.values(SubmissionVerdict), default: SubmissionVerdict.PENDING, index: true })
  verdict: SubmissionVerdict;

  @Prop({ type: Number, default: 0 })
  timeUsedMs: number;

  @Prop({ type: Number, default: 0 })
  memoryUsedKb: number;

  @Prop({ required: true })
  code: string;

  @Prop()
  errorMessage?: string;

  @Prop({ type: Number, default: 0 })
  testCasesPassed: number;

  @Prop({ type: Number, default: 0 })
  totalTestCases: number;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);

// Add compound indexes for efficient queries
SubmissionSchema.index({ user: 1, createdAt: -1 });
SubmissionSchema.index({ problem: 1, createdAt: -1 });
SubmissionSchema.index({ verdict: 1, createdAt: -1 });
SubmissionSchema.index({ user: 1, problem: 1 });