import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './controller/auth.controller';
import { ProblemController } from './controller/problem.controller';
import { SubmissionController } from './controller/submission.controller';
import { AuthService } from './service/auth.service';
import { ProblemService } from './service/problem.service';
import { SubmissionService } from './service/submission.service';

@Module({
  imports: [],
  controllers: [
    AppController,
    AuthController,
    ProblemController,
    SubmissionController,
  ],
  providers: [
    AppService,
    AuthService,
    ProblemService,
    SubmissionService,
  ],
})
export class AppModule {}
