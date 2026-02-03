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
import { JwtModule } from '@nestjs/jwt';
import { SuperAdminBootstrapService } from './service/superadmin-bootstrap.service';
import { JwtStrategy } from './guard/JwtStrategy';
import { RefreshTokenStrategy } from './guard/RefreshTokenStrategy';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    MongooseModule.forRoot(appConfig.database.uri),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Problem.name, schema: ProblemSchema },
      { name: Submission.name, schema: SubmissionSchema },
    ]),
    JwtModule.register({
      secret: appConfig.jwt.secret,
      signOptions: { expiresIn: appConfig.jwt.expiresIn },
    }),
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
    SuperAdminBootstrapService,
    JwtStrategy,
    RefreshTokenStrategy,
  ],
})
export class AppModule {}
