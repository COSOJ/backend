import { execFileSync } from 'child_process';
import { DockerCodeExecutor } from './docker-code-executor';
import { LanguageRegistry } from './language.registry';
import { JudgeService, JudgeTestCase } from './judge.service';
import { OutputComparator } from './output-comparator';
import { ExecutionLimits, ExecutionStatus } from './code-executor.interface';
import { ProgrammingLanguage, SubmissionVerdict } from '../schema/Submission';

/**
 * REAL end-to-end judging against the actual Docker sandbox images. These prove
 * the judge genuinely compiles/runs untrusted code and produces correct
 * verdicts — not just that the orchestration logic is internally consistent.
 *
 * Gated behind RUN_DOCKER_JUDGE_TESTS=1 because they require a Docker daemon
 * and the built cosoj-judge-* images, which CI does not have. Run locally with:
 *   RUN_DOCKER_JUDGE_TESTS=1 npx jest docker-code-executor.integration
 */
const ENABLED = process.env.RUN_DOCKER_JUDGE_TESTS === '1';
const suite = ENABLED ? describe : describe.skip;

function imagePresent(image: string): boolean {
  try {
    const out = execFileSync('docker', ['images', '-q', image], {
      encoding: 'utf-8',
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

suite('DockerCodeExecutor (real Docker)', () => {
  jest.setTimeout(180000);

  const registry = new LanguageRegistry();
  const executor = new DockerCodeExecutor(registry);
  const service = new JudgeService(
    {} as never,
    {} as never,
    {} as never,
    executor,
    new OutputComparator(),
  );

  const pyImage = registry.get(ProgrammingLanguage.PYTHON).image;
  const cppImage = registry.get(ProgrammingLanguage.CPP).image;

  beforeAll(() => {
    if (!imagePresent(pyImage)) {
      throw new Error(
        `Image ${pyImage} missing. Build judge images first (judge/build-images.sh).`,
      );
    }
  });

  const addCases: JudgeTestCase[] = [
    { input: '2\n3\n', expected: '5' },
    { input: '10\n20\n', expected: '30' },
  ];
  const limits: ExecutionLimits = { timeLimitMs: 2000, memoryLimitMb: 256 };

  const pyAdd = 'a=int(input())\nb=int(input())\nprint(a+b)\n';

  describe('Python', () => {
    it('accepts a correct solution and measures time + memory', async () => {
      const outcome = await service.evaluate(
        ProgrammingLanguage.PYTHON,
        pyAdd,
        addCases,
        limits,
      );
      expect(outcome.verdict).toBe(SubmissionVerdict.ACCEPTED);
      expect(outcome.testCasesPassed).toBe(2);
      expect(outcome.totalTestCases).toBe(2);
      expect(outcome.memoryUsedKb).toBeGreaterThan(0);
    });

    it('rejects a wrong solution as WRONG_ANSWER', async () => {
      const wrong = 'a=int(input())\nb=int(input())\nprint(a*b)\n';
      const outcome = await service.evaluate(
        ProgrammingLanguage.PYTHON,
        wrong,
        addCases,
        limits,
      );
      expect(outcome.verdict).toBe(SubmissionVerdict.WRONG_ANSWER);
      expect(outcome.testCasesPassed).toBe(0);
    });

    it('reports RUNTIME_ERROR for a crashing solution', async () => {
      const crash = 'raise ValueError("boom")\n';
      const outcome = await service.evaluate(
        ProgrammingLanguage.PYTHON,
        crash,
        addCases,
        limits,
      );
      expect(outcome.verdict).toBe(SubmissionVerdict.RUNTIME_ERROR);
    });

    it('reports TIME_LIMIT_EXCEEDED for an infinite loop', async () => {
      const loop = 'while True:\n    pass\n';
      const outcome = await service.evaluate(
        ProgrammingLanguage.PYTHON,
        loop,
        [{ input: '', expected: 'never' }],
        { timeLimitMs: 800, memoryLimitMb: 256 },
      );
      expect(outcome.verdict).toBe(SubmissionVerdict.TIME_LIMIT_EXCEEDED);
    });

    it('reports MEMORY_LIMIT_EXCEEDED for an over-allocating solution', async () => {
      const hog = 'x = bytearray(300 * 1024 * 1024)\nprint(len(x))\n';
      const outcome = await service.evaluate(
        ProgrammingLanguage.PYTHON,
        hog,
        [{ input: '', expected: 'never' }],
        { timeLimitMs: 5000, memoryLimitMb: 64 },
      );
      expect(outcome.verdict).toBe(SubmissionVerdict.MEMORY_LIMIT_EXCEEDED);
    });
  });

  describe('C++', () => {
    const runIfCpp = imagePresent(cppImage) ? it : it.skip;

    runIfCpp('compiles and accepts a correct solution', async () => {
      const src =
        '#include <iostream>\nint main(){long a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;return 0;}\n';
      const outcome = await service.evaluate(
        ProgrammingLanguage.CPP,
        src,
        addCases,
        limits,
      );
      expect(outcome.verdict).toBe(SubmissionVerdict.ACCEPTED);
    });

    runIfCpp('reports COMPILATION_ERROR for invalid code', async () => {
      const bad = 'int main(){ this is not c++ }\n';
      const outcome = await service.evaluate(
        ProgrammingLanguage.CPP,
        bad,
        addCases,
        limits,
      );
      expect(outcome.verdict).toBe(SubmissionVerdict.COMPILATION_ERROR);
      expect(outcome.errorMessage).toBeTruthy();
    });
  });

  describe('low-level executor', () => {
    it('returns OK with stdout for a direct run', async () => {
      const prep = await executor.prepare(ProgrammingLanguage.PYTHON, pyAdd);
      expect(prep.compile.success).toBe(true);
      const program = prep.program!;
      try {
        const result = await executor.run(program, '7\n8\n', limits);
        expect(result.status).toBe(ExecutionStatus.OK);
        expect(result.stdout.trim()).toBe('15');
        expect(result.memoryKb).toBeGreaterThan(0);
      } finally {
        await executor.cleanup(program);
      }
    });
  });
});
