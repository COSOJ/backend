import { IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  handle: string;

  @IsString()
  password: string;
}
