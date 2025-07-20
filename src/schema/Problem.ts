import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Problem extends Document {
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

  @Prop({ type: Object }) 
  samples: Record<string, string>[];

  @Prop({ default: [] })
  tags: string[];
}

export const ProblemSchema = SchemaFactory.createForClass(Problem);