import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface TestCase {
  input: string;
  output: string;
  isPublic: boolean; // true for visible to users, false for hidden test cases
}

@Schema({ timestamps: true })
export class Problem extends Document<string> {
  @Prop({ required: true })
  code: string;

  @Prop()
  title: string;
  
  @Prop()
  statement: string;

  @Prop()
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

  @Prop({ default: [] })
  tags: string[];

  @Prop({ type: String, enum: ['public', 'private'], default: 'private' })
  visibility: 'public' | 'private';
}

export const ProblemSchema = SchemaFactory.createForClass(Problem);