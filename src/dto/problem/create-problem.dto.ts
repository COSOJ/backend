import {
  IsString,
  IsArray,
  IsOptional,
  IsNumber,
  IsObject,
  IsBoolean,
} from 'class-validator';

export interface TestCaseDto {
  input: string;
  output: string;
  isPublic: boolean;
}

export class CreateProblemDto {
  @IsString()
  code: string;

  @IsString()
  title: string;

  @IsString()
  statement: string;

  @IsNumber()
  difficulty: number;

  @IsNumber()
  timeLimitMs: number;

  @IsNumber()
  memoryLimitMb: number;

  @IsString()
  inputSpec: string;

  @IsString()
  outputSpec: string;

  @IsArray()
  @IsObject({ each: true })
  cases: TestCaseDto[];

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsString()
  visibility?: 'public' | 'private';
}
