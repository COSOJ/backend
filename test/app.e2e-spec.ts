import * as request from 'supertest';

jest.setTimeout(30000);

type RegisterResponse = {
  user?: {
    _id?: string;
  };
};

type MeResponse = {
  handle?: string;
};

type ProblemResponse = {
  _id?: string;
  id?: string;
  code?: string;
  title?: string;
};

type ProblemListResponse = {
  items?: ProblemResponse[];
};

type SubmissionResponse = {
  _id?: string;
  verdict?: string;
};

type SourceResponse = {
  sourceCode?: string;
};

describe('Backend E2E Flow', () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const adminAgent = request.agent(baseUrl);
  const userAgent = request.agent(baseUrl);
  const anon = request(baseUrl);

  const adminEmail = process.env.E2E_ADMIN_EMAIL || 'superadmin@example.com';
  const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'supersecurepassword';

  const unique = Date.now().toString();
  const userPayload = {
    handle: `e2e_user_${unique}`,
    email: `e2e_user_${unique}@example.com`,
    password: 'e2e_pass_1234',
  };

  const problemPayload = {
    code: `E2E_${unique}`,
    title: 'E2E Problem',
    statement: 'E2E statement',
    difficulty: 1,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    inputSpec: 'Input spec',
    outputSpec: 'Output spec',
    cases: [{ input: '1 2', output: '3', isPublic: true }],
    tags: ['e2e'],
    visibility: 'public' as const,
  };

  const submissionCode = 'print("e2e")\n';

  let userId = '';
  let problemId = '';
  let submissionId = '';

  beforeAll(async () => {
    await adminAgent
      .post('/auth/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(201);

    const registerRes = await userAgent
      .post('/auth/register')
      .send(userPayload)
      .expect(201);

    const registerBody = registerRes.body as RegisterResponse;
    userId = registerBody.user?._id || '';
    expect(userId).toBeTruthy();
  });

  it('runs full system flow with pass/fail checks', async () => {
    await anon.get('/').expect(200).expect('Hello World!');

    await anon
      .post('/auth/login')
      .send({ email: userPayload.email, password: 'wrong-password' })
      .expect(401);

    const meRes = await userAgent.get('/auth/me').expect(200);
    const meBody = meRes.body as MeResponse;
    expect(meBody.handle).toBe(userPayload.handle);

    await userAgent.post('/problems').send(problemPayload).expect(403);

    const createProblemRes = await adminAgent
      .post('/problems')
      .send(problemPayload)
      .expect(201);

    const createProblemBody = createProblemRes.body as ProblemResponse;
    problemId = createProblemBody._id || createProblemBody.id || '';
    expect(problemId).toBeTruthy();

    const listRes = await userAgent.get('/problems').expect(200);
    const listBody = listRes.body as ProblemListResponse;
    const items = Array.isArray(listBody.items) ? listBody.items : [];
    expect(items.some((item) => item?._id === problemId)).toBe(true);

    const getRes = await userAgent.get(`/problems/${problemId}`).expect(200);
    const getBody = getRes.body as ProblemResponse;
    expect(getBody.code).toBe(problemPayload.code);

    await userAgent
      .put(`/problems/${problemId}`)
      .send({ ...problemPayload, title: 'E2E Updated' })
      .expect(403);

    const updateRes = await adminAgent
      .put(`/problems/${problemId}`)
      .send({ ...problemPayload, title: 'E2E Updated' })
      .expect(200);
    const updateBody = updateRes.body as ProblemResponse;
    expect(updateBody.title).toBe('E2E Updated');

    const submissionRes = await userAgent
      .post('/submissions')
      .send({
        problem: problemId,
        language: 'python',
        code: submissionCode,
      })
      .expect(201);

    const submissionBody = submissionRes.body as SubmissionResponse;
    submissionId = submissionBody._id || '';
    expect(submissionId).toBeTruthy();

    await userAgent.get(`/submissions/${submissionId}`).expect(200);
    await anon.get(`/submissions/${submissionId}`).expect(403);

    await userAgent
      .put(`/submissions/${submissionId}/verdict`)
      .send({ verdict: 'accepted' })
      .expect(403);

    const verdictRes = await adminAgent
      .put(`/submissions/${submissionId}/verdict`)
      .send({
        verdict: 'accepted',
        timeUsedMs: 10,
        memoryUsedKb: 1024,
        testCasesPassed: 1,
        totalTestCases: 1,
      })
      .expect(200);
    const verdictBody = verdictRes.body as SubmissionResponse;
    expect(verdictBody.verdict).toBe('accepted');

    const sourceRes = await userAgent
      .get(`/submissions/${submissionId}/source`)
      .expect(200);
    const sourceBody = sourceRes.body as SourceResponse;
    expect(sourceBody.sourceCode).toBe(submissionCode);

    await userAgent.get(`/submissions/user/${userId}`).expect(200);
    await anon.get(`/submissions/user/${userId}`).expect(403);

    await adminAgent.delete(`/problems/${problemId}`).expect(200);
  });
});
