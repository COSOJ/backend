import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  problem: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  verdict?: string;

  @IsOptional()
  @IsNumber()
  timeUsedMs?: number;

  @IsOptional()
  @IsNumber()
  memoryUsedKb?: number;
}
