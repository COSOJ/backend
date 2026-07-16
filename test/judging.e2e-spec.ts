import * as request from 'supertest';

/**
 * End-to-end judging test against a running stack (backend + Mongo + MinIO +
 * Docker judge images). Proves that a submission created over HTTP is judged
 * asynchronously and reaches the correct verdict.
 *
 * Requires the full stack to be up (see infra/docker-compose.yaml) and the
 * cosoj-judge-* images to be built on the host. Point E2E_BASE_URL at the API.
 */
jest.setTimeout(120000);

type Problem = { _id?: string; id?: string };
type Submission = {
  _id?: string;
  verdict?: string;
  testCasesPassed?: number;
  totalTestCases?: number;
};

const TERMINAL = new Set([
  'accepted',
  'wrong_answer',
  'time_limit_exceeded',
  'memory_limit_exceeded',
  'runtime_error',
  'compilation_error',
  'system_error',
]);

describe('Judging E2E', () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const admin = request.agent(baseUrl);
  const user = request.agent(baseUrl);

  const adminEmail = process.env.E2E_ADMIN_EMAIL || 'superadmin@example.com';
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'supersecurepassword';

  const unique = Date.now().toString();
  const problemPayload = {
    code: `JUDGE_${unique}`,
    title: 'Sum of two integers',
    statement: 'Read two integers and print their sum.',
    difficulty: 1,
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    inputSpec: 'Two integers a and b.',
    outputSpec: 'a + b',
    cases: [
      { input: '2 3', output: '5', isPublic: true },
      { input: '100 250', output: '350', isPublic: false },
    ],
    tags: ['math'],
    visibility: 'public' as const,
  };

  let problemId = '';

  async function pollVerdict(submissionId: string): Promise<Submission> {
    for (let i = 0; i < 60; i++) {
      const res = await user.get(`/submissions/${submissionId}`).expect(200);
      const body = res.body as Submission;
      if (body.verdict && TERMINAL.has(body.verdict)) {
        return body;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Timed out waiting for a terminal verdict');
  }

  async function submit(code: string): Promise<string> {
    const res = await user
      .post('/submissions')
      .send({ problem: problemId, language: 'python', code })
      .expect(201);
    const id = (res.body as Submission)._id;
    expect(id).toBeTruthy();
    return id as string;
  }

  beforeAll(async () => {
    await admin
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);

    const u = `judge_user_${unique}`;
    await user
      .post('/auth/register')
      .send({ handle: u, email: `${u}@example.com`, password: 'password1234' })
      .expect(201);

    const res = await admin.post('/problems').send(problemPayload).expect(201);
    const body = res.body as Problem;
    problemId = body._id || body.id || '';
    expect(problemId).toBeTruthy();
  });

  it('accepts a correct solution', async () => {
    const id = await submit('a,b=map(int,input().split())\nprint(a+b)\n');
    const result = await pollVerdict(id);
    expect(result.verdict).toBe('accepted');
    expect(result.testCasesPassed).toBe(2);
    expect(result.totalTestCases).toBe(2);
  });

  it('marks a wrong solution as wrong_answer', async () => {
    const id = await submit('a,b=map(int,input().split())\nprint(a-b)\n');
    const result = await pollVerdict(id);
    expect(result.verdict).toBe('wrong_answer');
  });

  it('marks an infinite loop as time_limit_exceeded', async () => {
    const id = await submit('while True:\n    pass\n');
    const result = await pollVerdict(id);
    expect(result.verdict).toBe('time_limit_exceeded');
  });

  it('marks a crashing solution as runtime_error', async () => {
    const id = await submit('raise SystemExit(1)\n');
    const result = await pollVerdict(id);
    expect(result.verdict).toBe('runtime_error');
  });
});
