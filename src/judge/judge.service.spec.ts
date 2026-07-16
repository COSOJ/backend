import { JudgeService, JudgeTestCase } from './judge.service';
import { OutputComparator } from './output-comparator';
import {
  ExecutionLimits,
  ExecutionStatus,
  ICodeExecutor,
  PrepareResult,
  PreparedProgram,
  RunResult,
} from './code-executor.interface';
import { ProgrammingLanguage, SubmissionVerdict } from '../schema/Submission';

const LIMITS: ExecutionLimits = { timeLimitMs: 1000, memoryLimitMb: 256 };

function okRun(stdout: string, timeMs = 10, memoryKb = 1024): RunResult {
  return {
    status: ExecutionStatus.OK,
    stdout,
    stderr: '',
    exitCode: 0,
    signal: null,
    timeMs,
    memoryKb,
  };
}

function failRun(status: ExecutionStatus, stderr = ''): RunResult {
  return {
    status,
    stdout: '',
    stderr,
    exitCode: status === ExecutionStatus.RUNTIME_ERROR ? 1 : null,
    signal: null,
    timeMs: 5,
    memoryKb: 512,
  };
}

/** Programmable in-memory executor so judging logic is tested without Docker. */
class StubExecutor implements ICodeExecutor {
  compileSuccess = true;
  compileStderr = '';
  runResults: RunResult[] = [];
  prepareCalls = 0;
  runCalls = 0;
  cleanupCalls = 0;

  prepare(language: ProgrammingLanguage): Promise<PrepareResult> {
    this.prepareCalls++;
    if (!this.compileSuccess) {
      return Promise.resolve({
        compile: { success: false, stderr: this.compileStderr, timeMs: 3 },
      });
    }
    const program: PreparedProgram = {
      id: 'stub',
      language,
      workdir: '/tmp/stub',
    };
    return Promise.resolve({
      compile: { success: true, stderr: '', timeMs: 3 },
      program,
    });
  }

  run(): Promise<RunResult> {
    const result =
      this.runResults[this.runCalls] ??
      this.runResults[this.runResults.length - 1];
    this.runCalls++;
    return Promise.resolve(result);
  }

  cleanup(): Promise<void> {
    this.cleanupCalls++;
    return Promise.resolve();
  }
}

describe('JudgeService.evaluate', () => {
  let executor: StubExecutor;
  let service: JudgeService;

  const cases: JudgeTestCase[] = [
    { input: '1 2', expected: '3' },
    { input: '4 5', expected: '9' },
  ];

  beforeEach(() => {
    executor = new StubExecutor();
    service = new JudgeService(
      {} as never,
      {} as never,
      {} as never,
      executor,
      new OutputComparator(),
    );
  });

  it('returns ACCEPTED when every test case matches', async () => {
    executor.runResults = [okRun('3', 12, 2048), okRun('9', 30, 4096)];

    const outcome = await service.evaluate(
      ProgrammingLanguage.PYTHON,
      'code',
      cases,
      LIMITS,
    );

    expect(outcome.verdict).toBe(SubmissionVerdict.ACCEPTED);
    expect(outcome.testCasesPassed).toBe(2);
    expect(outcome.totalTestCases).toBe(2);
    expect(outcome.timeUsedMs).toBe(30); // max across cases
    expect(outcome.memoryUsedKb).toBe(4096); // max across cases
    expect(executor.cleanupCalls).toBe(1);
  });

  it('returns WRONG_ANSWER and stops at the first failing case', async () => {
    const three: JudgeTestCase[] = [
      { input: 'a', expected: '1' },
      { input: 'b', expected: '2' },
      { input: 'c', expected: '3' },
    ];
    executor.runResults = [okRun('1'), okRun('WRONG'), okRun('3')];

    const outcome = await service.evaluate(
      ProgrammingLanguage.PYTHON,
      'code',
      three,
      LIMITS,
    );

    expect(outcome.verdict).toBe(SubmissionVerdict.WRONG_ANSWER);
    expect(outcome.testCasesPassed).toBe(1);
    expect(outcome.totalTestCases).toBe(3);
    expect(executor.runCalls).toBe(2); // stopped, did not run the 3rd
    expect(executor.cleanupCalls).toBe(1);
  });

  it('returns COMPILATION_ERROR without running any case', async () => {
    executor.compileSuccess = false;
    executor.compileStderr = 'main.cpp:1: error: expected ;';

    const outcome = await service.evaluate(
      ProgrammingLanguage.CPP,
      'bad',
      cases,
      LIMITS,
    );

    expect(outcome.verdict).toBe(SubmissionVerdict.COMPILATION_ERROR);
    expect(outcome.testCasesPassed).toBe(0);
    expect(outcome.errorMessage).toContain('error: expected');
    expect(executor.runCalls).toBe(0);
    expect(executor.cleanupCalls).toBe(0);
  });

  it('maps a time limit failure to TIME_LIMIT_EXCEEDED', async () => {
    executor.runResults = [failRun(ExecutionStatus.TIME_LIMIT_EXCEEDED)];
    const outcome = await service.evaluate(
      ProgrammingLanguage.PYTHON,
      'code',
      cases,
      LIMITS,
    );
    expect(outcome.verdict).toBe(SubmissionVerdict.TIME_LIMIT_EXCEEDED);
    expect(outcome.testCasesPassed).toBe(0);
  });

  it('maps a memory failure to MEMORY_LIMIT_EXCEEDED', async () => {
    executor.runResults = [
      okRun('3'),
      failRun(ExecutionStatus.MEMORY_LIMIT_EXCEEDED),
    ];
    const outcome = await service.evaluate(
      ProgrammingLanguage.PYTHON,
      'code',
      cases,
      LIMITS,
    );
    expect(outcome.verdict).toBe(SubmissionVerdict.MEMORY_LIMIT_EXCEEDED);
    expect(outcome.testCasesPassed).toBe(1);
  });

  it('maps a runtime failure to RUNTIME_ERROR and surfaces stderr', async () => {
    executor.runResults = [
      failRun(ExecutionStatus.RUNTIME_ERROR, 'Traceback: ZeroDivisionError'),
    ];
    const outcome = await service.evaluate(
      ProgrammingLanguage.PYTHON,
      'code',
      cases,
      LIMITS,
    );
    expect(outcome.verdict).toBe(SubmissionVerdict.RUNTIME_ERROR);
    expect(outcome.errorMessage).toContain('ZeroDivisionError');
  });

  it('maps a sandbox internal failure to SYSTEM_ERROR', async () => {
    executor.runResults = [failRun(ExecutionStatus.INTERNAL_ERROR)];
    const outcome = await service.evaluate(
      ProgrammingLanguage.PYTHON,
      'code',
      cases,
      LIMITS,
    );
    expect(outcome.verdict).toBe(SubmissionVerdict.SYSTEM_ERROR);
  });

  it('returns SYSTEM_ERROR when the problem has no test cases', async () => {
    const outcome = await service.evaluate(
      ProgrammingLanguage.PYTHON,
      'code',
      [],
      LIMITS,
    );
    expect(outcome.verdict).toBe(SubmissionVerdict.SYSTEM_ERROR);
    expect(outcome.errorMessage).toMatch(/no test cases/i);
    expect(executor.prepareCalls).toBe(0);
  });
});

describe('JudgeService.judge', () => {
  let executor: StubExecutor;

  function buildService(overrides: {
    submission?: unknown;
    problem?: unknown;
    code?: string;
  }) {
    const updates: Array<Record<string, unknown>> = [];
    const submissionModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(overrides.submission ?? null),
      }),
      findByIdAndUpdate: jest.fn().mockImplementation((_id, update) => {
        updates.push(update as Record<string, unknown>);
        return { exec: jest.fn().mockResolvedValue({}) };
      }),
    };
    const problemModel = {
      findById: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(overrides.problem ?? null),
      }),
    };
    const fileStorage = {
      getFile: jest
        .fn()
        .mockResolvedValue(Buffer.from(overrides.code ?? 'print(3)')),
    };
    const service = new JudgeService(
      submissionModel as never,
      problemModel as never,
      fileStorage as never,
      executor,
      new OutputComparator(),
    );
    return { service, submissionModel, problemModel, fileStorage, updates };
  }

  const submission = {
    _id: 's1',
    problem: 'p1',
    language: ProgrammingLanguage.PYTHON,
    sourceFile: { bucket: 'submissions', key: 'src/s1.py' },
  };

  const problem = {
    _id: 'p1',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    cases: [
      { input: '1 2', output: '3', isPublic: true },
      { input: '4 5', output: '9', isPublic: false },
    ],
  };

  beforeEach(() => {
    executor = new StubExecutor();
  });

  it('persists ACCEPTED with judging set first for a correct submission', async () => {
    executor.runResults = [okRun('3', 11, 2048), okRun('9', 22, 3072)];
    const { service, submissionModel, updates } = buildService({
      submission,
      problem,
    });

    await service.judge('s1');

    // First update flips to JUDGING, last persists the final verdict.
    expect(updates[0]).toEqual({ verdict: SubmissionVerdict.JUDGING });
    const final = updates[updates.length - 1];
    expect(final.verdict).toBe(SubmissionVerdict.ACCEPTED);
    expect(final.testCasesPassed).toBe(2);
    expect(final.totalTestCases).toBe(2);
    expect(final.timeUsedMs).toBe(22);
    expect(final.memoryUsedKb).toBe(3072);
    expect(submissionModel.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('persists WRONG_ANSWER for an incorrect submission', async () => {
    executor.runResults = [okRun('3'), okRun('42')];
    const { service, updates } = buildService({ submission, problem });

    await service.judge('s1');

    expect(updates[updates.length - 1].verdict).toBe(
      SubmissionVerdict.WRONG_ANSWER,
    );
  });

  it('does nothing when the submission does not exist', async () => {
    const { service, submissionModel } = buildService({ submission: null });
    await service.judge('missing');
    expect(submissionModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('persists SYSTEM_ERROR when the problem is missing', async () => {
    const { service, updates } = buildService({ submission, problem: null });
    await service.judge('s1');
    expect(updates[updates.length - 1].verdict).toBe(
      SubmissionVerdict.SYSTEM_ERROR,
    );
  });

  it('persists SYSTEM_ERROR when source code cannot be loaded', async () => {
    const { service, fileStorage, updates } = buildService({
      submission,
      problem,
    });
    fileStorage.getFile.mockRejectedValueOnce(new Error('minio down'));

    await service.judge('s1');

    expect(updates[updates.length - 1].verdict).toBe(
      SubmissionVerdict.SYSTEM_ERROR,
    );
  });
});
