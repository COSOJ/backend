import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface TestCase {
  input: string;
  output: string;
  isPublic: boolean; // true for visible to users, false for hidden test cases
}

@Schema({ timestamps: true })
export class Problem extends Document<string> {
  @Prop({ required: true, unique: true, index: true })
  code: string;

  @Prop({ index: true })
  title: string;
  
  @Prop()
  statement: string;

  @Prop({ index: true })
  difficulty: number;

  @Prop()
  timeLimitMs: number;

  @Prop()
  memoryLimitMb: number;

  @Prop()
  inputSpec: string;

  @Prop()
  outputSpec: string;

  @Prop({ type: [Object], default: [] })
  cases: TestCase[];

  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({ type: String, enum: ['public', 'private'], default: 'private', index: true })
  visibility: 'public' | 'private';
}

export const ProblemSchema = SchemaFactory.createForClass(Problem);

// Add compound indexes for better query performance
ProblemSchema.index({ visibility: 1, difficulty: 1 });
ProblemSchema.index({ visibility: 1, tags: 1 });
ProblemSchema.index({ createdAt: -1 });