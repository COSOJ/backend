import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Submission, SubmissionSchema } from '../schema/Submission';
import { Problem, ProblemSchema } from '../schema/Problem';
import { FileStorageService } from '../service/file-storage.service';
import { LanguageRegistry } from './language.registry';
import { OutputComparator } from './output-comparator';
import { DockerCodeExecutor } from './docker-code-executor';
import { CODE_EXECUTOR } from './code-executor.interface';
import { JudgeService } from './judge.service';
import { JudgeQueue } from './judge.queue';

/**
 * Self-contained judging subsystem. Owns the sandbox executor and exposes the
 * {@link JudgeQueue} that the rest of the app uses to schedule work. Also owns
 * the shared {@link FileStorageService} so there is a single MinIO client.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Submission.name, schema: SubmissionSchema },
      { name: Problem.name, schema: ProblemSchema },
    ]),
  ],
  providers: [
    FileStorageService,
    LanguageRegistry,
    OutputComparator,
    { provide: CODE_EXECUTOR, useClass: DockerCodeExecutor },
    JudgeService,
    JudgeQueue,
  ],
  exports: [JudgeQueue, JudgeService, FileStorageService],
})
export class JudgeModule {}
