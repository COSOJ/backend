# backend

COSOJ API (NestJS + MongoDB + MinIO) including the **judge**: submissions are
compiled and run against a problem's test cases in sandboxed Docker containers,
and a verdict (Accepted / Wrong Answer / TLE / MLE / Runtime Error /
Compilation Error) is computed and stored.

## Architecture

- `src/service` — auth, problems, submissions, file storage (MinIO).
- `src/judge` — the judging subsystem:
  - `LanguageRegistry` — language → image + compile/run commands.
  - `OutputComparator` — result matching (token / exact).
  - `ICodeExecutor` + `DockerCodeExecutor` — the sandbox abstraction and its
    Docker implementation (time/memory/pids/network limits).
  - `JudgeService` — compile-once, run-each-case, aggregate verdict.
  - `JudgeQueue` — bounded-concurrency async dispatch.

When a submission is created it is uploaded to MinIO and enqueued; the queue
judges it asynchronously and fills in the verdict. Clients poll
`GET /submissions/:id`.

## Running

```bash
pnpm install
pnpm start:dev        # needs MongoDB + MinIO (see ../infra) and a Docker daemon
```

The judge shells out to `docker` and requires the `cosoj-judge-*` images
(build them with `../judge/build-images.sh`). Set `JUDGE_ENABLED=false` to accept
submissions without judging (e.g. on hosts without Docker). Key env vars:
`MONGODB_URI`, `MINIO_*`, `JWT_*`, `JUDGE_CONCURRENCY`, `JUDGE_WORKDIR`.

## Test

```bash
pnpm test                                   # unit tests (no Docker needed)
RUN_DOCKER_JUDGE_TESTS=1 pnpm test          # + real Docker judge integration tests
pnpm test:e2e                               # end-to-end against a running stack
```

The judge integration tests (`src/judge/docker-code-executor.integration.spec.ts`)
run real submissions through the actual sandbox images and are skipped unless
`RUN_DOCKER_JUDGE_TESTS=1` is set.

### Coverage
<!-- start test coverage -->

File                              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------------------------|---------|----------|---------|---------|-------------------
All files                         |   30.58 |    12.96 |    29.8 |   28.73 |                   
 src                              |   24.52 |        0 |      50 |   19.14 |                   
  app.controller.ts               |     100 |      100 |     100 |     100 |                   
  app.module.ts                   |       0 |      100 |     100 |       0 | 1-53              
  app.service.ts                  |     100 |      100 |     100 |     100 |                   
  main.ts                         |       0 |        0 |       0 |       0 | 1-46              
 src/config                       |       0 |        0 |     100 |       0 |                   
  app.config.ts                   |       0 |        0 |     100 |       0 | 1                 
  development.config.ts           |       0 |      100 |     100 |       0 | 2                 
 src/controller                   |   26.72 |     8.77 |   35.48 |   25.83 |                   
  auth.controller.ts              |     100 |      100 |     100 |     100 |                   
  file.controller.ts              |       0 |        0 |       0 |       0 | 1-315             
  problem.controller.ts           |   91.66 |      100 |   66.66 |    90.9 | 39,46             
  submission.controller.ts        |       0 |        0 |       0 |       0 | 1-170             
 src/decorator                    |   60.71 |      100 |      50 |   47.61 |                   
  current-user.decorator.ts       |       0 |      100 |       0 |       0 | 1-8               
  no-cache.decorator.ts           |      65 |      100 |      50 |   53.33 | 28-42             
  roles.decorator.ts              |     100 |      100 |     100 |     100 |                   
 src/dto/auth                     |     100 |      100 |     100 |     100 |                   
  login.dto.ts                    |     100 |      100 |     100 |     100 |                   
  register.dto.ts                 |     100 |      100 |     100 |     100 |                   
 src/dto/problem                  |     100 |      100 |     100 |     100 |                   
  create-problem.dto.ts           |     100 |      100 |     100 |     100 |                   
 src/dto/submission               |       0 |      100 |     100 |       0 |                   
  create-submission.dto.ts        |       0 |      100 |     100 |       0 | 1-50              
 src/guard                        |   43.83 |    23.52 |   33.33 |   38.33 |                   
  JwtAuthGuard.ts                 |     100 |      100 |     100 |     100 |                   
  JwtStrategy.ts                  |       0 |        0 |       0 |       0 | 1-45              
  OptionalJwtAuthGuard.ts         |     100 |      100 |     100 |     100 |                   
  RefreshTokenGuard.ts            |     100 |      100 |     100 |     100 |                   
  RefreshTokenStrategy.ts         |       0 |        0 |       0 |       0 | 1-38              
  RolesGuard.ts                   |     100 |      100 |     100 |     100 |                   
 src/schema                       |   48.52 |        0 |       0 |   46.77 |                   
  Problem.ts                      |     100 |      100 |     100 |     100 |                   
  Submission.ts                   |       0 |        0 |       0 |       0 | 1-91              
  User.ts                         |     100 |      100 |     100 |     100 |                   
 src/service                      |   20.55 |    17.11 |   20.45 |   20.59 |                   
  auth.service.ts                 |   26.47 |        0 |       0 |   23.33 | 13-60             
  file-storage.service.ts         |       0 |        0 |       0 |       0 | 1-314             
  problem.service.ts              |     100 |    79.16 |     100 |     100 | 56-58,95,151      
  submission.service.ts           |       0 |        0 |       0 |       0 | 1-366             
  superadmin-bootstrap.service.ts |       0 |        0 |       0 |       0 | 1-30              
 src/types                        |       0 |        0 |       0 |       0 |                   
  express.d.ts                    |       0 |        0 |       0 |       0 |                   
  passport-jwt.d.ts               |       0 |        0 |       0 |       0 |                   

Test Suites: 6 passed, 6 total
Tests:       36 passed, 36 total
Snapshots:   0 total
Time:        13.377 s
Ran all test suites.

<!-- end test coverage -->
