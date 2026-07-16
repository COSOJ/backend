import * as os from 'os';

export const appConfig = {
  database: {
    uri:
      process.env.MONGODB_URI ||
      'mongodb://root:mongopassword@localhost:27017/cosoj?authSource=admin',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'development-refresh-secret-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'cosoj-admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'cosoj-password-123',
    buckets: {
      submissions: 'submissions',
      testCases: 'test-cases',
      attachments: 'attachments',
    },
  },
  file: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB
    allowedTypes: [
      'text/plain',
      'text/x-c',
      'text/x-c++',
      'text/x-java',
      'text/x-python',
      'application/javascript',
    ],
  },
  judge: {
    // When false, submissions are accepted but never dispatched to the sandbox
    // (useful for environments without a Docker daemon).
    enabled: process.env.JUDGE_ENABLED !== 'false',
    // How many submissions are judged concurrently by the in-process queue.
    concurrency: parseInt(process.env.JUDGE_CONCURRENCY || '2', 10),
    // Extra wall-clock budget on top of the problem time limit to absorb
    // container startup overhead before a run is declared TLE.
    startupGraceMs: parseInt(process.env.JUDGE_STARTUP_GRACE_MS || '3000', 10),
    compileTimeoutMs: parseInt(
      process.env.JUDGE_COMPILE_TIMEOUT_MS || '20000',
      10,
    ),
    compileMemoryMb: parseInt(process.env.JUDGE_COMPILE_MEMORY_MB || '512', 10),
    pidsLimit: parseInt(process.env.JUDGE_PIDS_LIMIT || '256', 10),
    dockerBinary: process.env.JUDGE_DOCKER_BINARY || 'docker',
    // Base directory for per-run sandbox workspaces. When the backend runs in a
    // container and spawns sibling judge containers via the host's docker
    // socket, this MUST be a path that is bind-mounted at the SAME location on
    // both the host and the backend container, so `docker run -v` resolves it.
    workdir: process.env.JUDGE_WORKDIR || os.tmpdir(),
  },
};
