import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthController } from './controller/auth.controller';
import { ProblemController } from './controller/problem.controller';
import { SubmissionController } from './controller/submission.controller';
import { AuthService } from './service/auth.service';
import { ProblemService } from './service/problem.service';
import { SubmissionService } from './service/submission.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schema/User';
import { Problem, ProblemSchema } from './schema/Problem';
import { Submission, SubmissionSchema } from './schema/Submission';
import { JwtService } from '@nestjs/jwt';
import { SuperAdminBootstrapService } from './service/superadmin-bootstrap.service';

@Module({
  imports: [
    // todo: use env variable for db url, later
    MongooseModule.forRoot('mongodb://root:mongopassword@localhost:27017/cosoj?authSource=admin'),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Problem.name, schema: ProblemSchema },
      { name: Submission.name, schema: SubmissionSchema },
    ]),
  ],
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
    JwtService,
    SuperAdminBootstrapService,
  ],
})
export class AppModule {}
