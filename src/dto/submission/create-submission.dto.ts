import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, MaxLength, MinLength } from 'class-validator';
import { ProgrammingLanguage } from '../../schema/Submission';

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  problem: string;

  @IsEnum(ProgrammingLanguage)
  language: ProgrammingLanguage;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Code cannot be empty' })
  @MaxLength(50000, { message: 'Code is too long (max 50,000 characters)' })
  code: string;
}

export class SubmissionQueryDto {
  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  problem?: string;

  @IsOptional()
  @IsEnum(ProgrammingLanguage)
  language?: ProgrammingLanguage;

  @IsOptional()
  @IsString()
  verdict?: string;

  @IsOptional()
  @IsNumber()
  current?: number = 1;

  @IsOptional()
  @IsNumber()
  pageSize?: number = 10;
}
