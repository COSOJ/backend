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
};
