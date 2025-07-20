import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ unique: true, required: true })
  handle: string;

  @Prop({ unique: true })
  email: string;

  @Prop() // hashed password
  passwordHash: string;

  @Prop() 
  avatarUrl: string;

  @Prop({ default: 1500 })
  rating: number;

  @Prop({ default: [] })
  ratingHistory: number[];
}

export const UserSchema = SchemaFactory.createForClass(User);