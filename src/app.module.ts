import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './controller/auth.controller';
import { ProblemController } from './controller/problem.controller';
import { SubmissionController } from './controller/submission.controller';

@Module({
  imports: [],
  controllers: [
    AppController,
    AuthController,
    ProblemController,
    SubmissionController,
  ],
  providers: [AppService],
})
export class AppModule {}
