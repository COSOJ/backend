import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Submission extends Document {
  @Prop({ type: 'ObjectId', ref: 'User' })
  user: string;

  @Prop({ type: 'ObjectId', ref: 'Problem' })
  problem: string;

  @Prop() 
  language: string;
  
  @Prop() 
  verdict: string;

  @Prop() 
  timeUsedMs: number;

  @Prop() 
  memoryUsedKb: number;

  @Prop() 
  code: string;
}

export const SubmissionSchema = SchemaFactory.createForClass(Submission);