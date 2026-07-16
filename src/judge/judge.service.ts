import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProgrammingLanguage,
  Submission,
  SubmissionVerdict,
} from '../schema/Submission';
import { Problem, TestCase } from '../schema/Problem';
import { FileStorageService } from '../service/file-storage.service';
import {
  CODE_EXECUTOR,
  ExecutionLimits,
  ExecutionStatus,
  ICodeExecutor,
  RunResult,
} from './code-executor.interface';
import { ComparisonMode, OutputComparator } from './output-comparator';

export interface JudgeTestCase {
  input: string;
  expected: string;
}

export interface JudgeOutcome {
  verdict: SubmissionVerdict;
  testCasesPassed: number;
  totalTestCases: number;
  timeUsedMs: number;
  memoryUsedKb: number;
  errorMessage?: string;
}

const MAX_ERROR_LENGTH = 4000;

/**
 * Owns the judging pipeline. {@link evaluate} is the pure, DB-free core:
 * compile once, run each test case, compare output, and reduce the mechanical
 * execution statuses into a single {@link SubmissionVerdict} (ICPC/Codeforces
 * style — stop at the first non-accepted test case). {@link judge} wraps it with
 * submission/problem loading and persistence.
 */
@Injectable()
export class JudgeService {
  private readonly logger = new Logger(JudgeService.name);

  constructor(
    @InjectModel(Submission.name)
    private readonly submissionModel: Model<Submission>,
    @InjectModel(Problem.name) private readonly problemModel: Model<Problem>,
    private readonly fileStorage: FileStorageService,
    @Inject(CODE_EXECUTOR) private readonly executor: ICodeExecutor,
    private readonly comparator: OutputComparator,
  ) {}

  /**
   * Judge a persisted submission end-to-end and store the resulting verdict.
   */
  async judge(submissionId: string): Promise<void> {
    const submission = await this.submissionModel.findById(submissionId).exec();
    if (!submission) {
      this.logger.warn(`Submission ${submissionId} not found; skipping judge`);
      return;
    }

    try {
      await this.submissionModel
        .findByIdAndUpdate(submissionId, {
          verdict: SubmissionVerdict.JUDGING,
        })
        .exec();

      const problem = await this.problemModel
        .findById(submission.problem)
        .exec();
      if (!problem) {
        await this.persist(submissionId, {
          verdict: SubmissionVerdict.SYSTEM_ERROR,
          testCasesPassed: 0,
          totalTestCases: 0,
          timeUsedMs: 0,
          memoryUsedKb: 0,
          errorMessage: 'Problem not found for submission',
        });
        return;
      }

      const code = await this.loadSourceCode(submission);
      const cases = await this.resolveTestCases(problem.cases || []);
      const limits: ExecutionLimits = {
        timeLimitMs: problem.timeLimitMs || 1000,
        memoryLimitMb: problem.memoryLimitMb || 256,
      };

      const outcome = await this.evaluate(
        submission.language,
        code,
        cases,
        limits,
      );
      await this.persist(submissionId, outcome);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown judging error';
      this.logger.error(`Judging failed for ${submissionId}: ${message}`);
      await this.persist(submissionId, {
        verdict: SubmissionVerdict.SYSTEM_ERROR,
        testCasesPassed: 0,
        totalTestCases: 0,
        timeUsedMs: 0,
        memoryUsedKb: 0,
        errorMessage: this.truncate(message),
      }).catch(() => undefined);
    }
  }

  /**
   * Pure judging core: no database, no storage. Compiles the program and runs
   * it against every test case, returning the aggregated outcome.
   */
  async evaluate(
    language: ProgrammingLanguage,
    code: string,
    cases: JudgeTestCase[],
    limits: ExecutionLimits,
    mode: ComparisonMode = ComparisonMode.TOKEN,
  ): Promise<JudgeOutcome> {
    const total = cases.length;
    if (total === 0) {
      return this.simpleOutcome(
        SubmissionVerdict.SYSTEM_ERROR,
        0,
        0,
        'Problem has no test cases',
      );
    }

    const prep = await this.executor.prepare(language, code);
    if (!prep.compile.success || !prep.program) {
      return this.simpleOutcome(
        SubmissionVerdict.COMPILATION_ERROR,
        0,
        total,
        this.truncate(prep.compile.stderr),
      );
    }

    const program = prep.program;
    let passed = 0;
    let maxTimeMs = 0;
    let maxMemoryKb = 0;

    try {
      for (const testCase of cases) {
        const result = await this.executor.run(program, testCase.input, limits);
        maxTimeMs = Math.max(maxTimeMs, result.timeMs);
        maxMemoryKb = Math.max(maxMemoryKb, result.memoryKb);

        const failure = this.mapExecutionFailure(result);
        if (failure) {
          return {
            verdict: failure,
            testCasesPassed: passed,
            totalTestCases: total,
            timeUsedMs: maxTimeMs,
            memoryUsedKb: maxMemoryKb,
            errorMessage: result.stderr
              ? this.truncate(result.stderr)
              : undefined,
          };
        }

        const correct = this.comparator.compare(
          testCase.expected,
          result.stdout,
          mode,
        );
        if (!correct) {
          return {
            verdict: SubmissionVerdict.WRONG_ANSWER,
            testCasesPassed: passed,
            totalTestCases: total,
            timeUsedMs: maxTimeMs,
            memoryUsedKb: maxMemoryKb,
          };
        }

        passed++;
      }

      return {
        verdict: SubmissionVerdict.ACCEPTED,
        testCasesPassed: passed,
        totalTestCases: total,
        timeUsedMs: maxTimeMs,
        memoryUsedKb: maxMemoryKb,
      };
    } finally {
      await this.executor.cleanup(program);
    }
  }

  /** Map a non-OK mechanical status to its verdict; null when the run was OK. */
  private mapExecutionFailure(result: RunResult): SubmissionVerdict | null {
    switch (result.status) {
      case ExecutionStatus.OK:
        return null;
      case ExecutionStatus.TIME_LIMIT_EXCEEDED:
        return SubmissionVerdict.TIME_LIMIT_EXCEEDED;
      case ExecutionStatus.MEMORY_LIMIT_EXCEEDED:
        return SubmissionVerdict.MEMORY_LIMIT_EXCEEDED;
      case ExecutionStatus.RUNTIME_ERROR:
        return SubmissionVerdict.RUNTIME_ERROR;
      case ExecutionStatus.COMPILE_ERROR:
        return SubmissionVerdict.COMPILATION_ERROR;
      default:
        return SubmissionVerdict.SYSTEM_ERROR;
    }
  }

  private async loadSourceCode(submission: Submission): Promise<string> {
    const buffer = await this.fileStorage.getFile(
      submission.sourceFile.bucket,
      submission.sourceFile.key,
    );
    return buffer.toString('utf-8');
  }

  private async resolveTestCases(cases: TestCase[]): Promise<JudgeTestCase[]> {
    const resolved: JudgeTestCase[] = [];
    for (const testCase of cases) {
      const input = await this.resolveContent(
        testCase.input,
        testCase.inputFile,
      );
      const expected = await this.resolveContent(
        testCase.output,
        testCase.outputFile,
      );
      resolved.push({ input, expected });
    }
    return resolved;
  }

  private async resolveContent(
    inline: string | undefined,
    file: { bucket: string; key: string } | undefined,
  ): Promise<string> {
    if (inline !== undefined && inline !== null) {
      return inline;
    }
    if (file && file.bucket && file.key) {
      const buffer = await this.fileStorage.getFile(file.bucket, file.key);
      return buffer.toString('utf-8');
    }
    return '';
  }

  private async persist(
    submissionId: string,
    outcome: JudgeOutcome,
  ): Promise<void> {
    await this.submissionModel
      .findByIdAndUpdate(submissionId, {
        verdict: outcome.verdict,
        testCasesPassed: outcome.testCasesPassed,
        totalTestCases: outcome.totalTestCases,
        timeUsedMs: outcome.timeUsedMs,
        memoryUsedKb: outcome.memoryUsedKb,
        errorMessage: outcome.errorMessage ?? '',
      })
      .exec();
  }

  private simpleOutcome(
    verdict: SubmissionVerdict,
    passed: number,
    total: number,
    errorMessage?: string,
  ): JudgeOutcome {
    return {
      verdict,
      testCasesPassed: passed,
      totalTestCases: total,
      timeUsedMs: 0,
      memoryUsedKb: 0,
      errorMessage,
    };
  }

  private truncate(value: string): string {
    if (!value) {
      return value;
    }
    return value.length > MAX_ERROR_LENGTH
      ? value.slice(0, MAX_ERROR_LENGTH) + '\n...[truncated]'
      : value;
  }
}
