import { IsString, IsArray, IsOptional, IsNumber, IsObject } from 'class-validator';

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
  samples: Record<string, string>[];

  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @IsOptional()
  @IsString()
  visibility?: 'public' | 'private';
}
