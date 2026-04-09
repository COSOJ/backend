import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { v4 as uuidv4 } from 'uuid';
import { appConfig } from '../config/app.config';
import { Readable } from 'stream';

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  bucket: string;
  key: string;
}

export interface UploadResult {
  key: string;
  bucket: string;
  url: string;
  metadata: FileMetadata;
}

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly minioClient: Client;

  constructor() {
    this.minioClient = new Client({
      endPoint: appConfig.minio.endPoint,
      port: appConfig.minio.port,
      useSSL: appConfig.minio.useSSL,
      accessKey: appConfig.minio.accessKey,
      secretKey: appConfig.minio.secretKey,
    });
  }

  async onModuleInit() {
    await this.initializeBuckets();
  }

  /**
   * Initialize required buckets if they don't exist
   */
  private async initializeBuckets(): Promise<void> {
    try {
      const buckets = Object.values(appConfig.minio.buckets);

      for (const bucket of buckets) {
        const exists = await this.minioClient.bucketExists(bucket);
        if (!exists) {
          await this.minioClient.makeBucket(bucket);
          this.logger.log(`Created bucket: ${bucket}`);
        }
      }

      // Set public read policy for attachments bucket
      const attachmentsBucket = appConfig.minio.buckets.attachments;
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${attachmentsBucket}/*`],
          },
        ],
      };

      await this.minioClient.setBucketPolicy(
        attachmentsBucket,
        JSON.stringify(policy),
      );

      this.logger.log('MinIO buckets initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize MinIO buckets', error);
      throw error;
    }
  }

  /**
   * Upload a file to MinIO
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    bucket: string,
    prefix?: string,
  ): Promise<UploadResult> {
    try {
      // Validate file type
      if (!appConfig.file.allowedTypes.includes(mimeType)) {
        throw new Error(`File type ${mimeType} is not allowed`);
      }

      // Validate file size
      if (buffer.length > appConfig.file.maxSize) {
        throw new Error(
          `File size exceeds maximum allowed size of ${appConfig.file.maxSize} bytes`,
        );
      }

      const fileExtension = this.getFileExtension(originalName);
      const key = `${prefix ? prefix + '/' : ''}${uuidv4()}${fileExtension}`;

      const stream = Readable.from(buffer);

      await this.minioClient.putObject(bucket, key, stream, buffer.length, {
        'Content-Type': mimeType,
        'Original-Name': originalName,
        'Upload-Date': new Date().toISOString(),
      });

      const url = await this.getFileUrl(bucket, key);

      const metadata: FileMetadata = {
        originalName,
        mimeType,
        size: buffer.length,
        uploadedAt: new Date(),
        bucket,
        key,
      };

      this.logger.log(`File uploaded successfully: ${key} to bucket ${bucket}`);

      return {
        key,
        bucket,
        url,
        metadata,
      };
    } catch (error) {
      this.logger.error('Failed to upload file', error);
      throw error;
    }
  }

  /**
   * Upload submission source code
   */
  async uploadSubmissionFile(
    code: string,
    language: string,
    submissionId: string,
  ): Promise<UploadResult> {
    const fileName = `submission-${submissionId}.${this.getLanguageExtension(language)}`;
    const buffer = Buffer.from(code, 'utf-8');

    return this.uploadFile(
      buffer,
      fileName,
      'text/plain',
      appConfig.minio.buckets.submissions,
      'source-code',
    );
  }

  /**
   * Upload test case files
   */
  async uploadTestCaseFile(
    content: string,
    type: 'input' | 'output',
    problemId: string,
    testCaseIndex: number,
  ): Promise<UploadResult> {
    const fileName = `${problemId}-test-${testCaseIndex}-${type}.txt`;
    const buffer = Buffer.from(content, 'utf-8');

    return this.uploadFile(
      buffer,
      fileName,
      'text/plain',
      appConfig.minio.buckets.testCases,
      problemId,
    );
  }

  /**
   * Get file from MinIO
   */
  async getFile(bucket: string, key: string): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(bucket, key);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: unknown) => {
          if (Buffer.isBuffer(chunk)) {
            chunks.push(chunk);
            return;
          }
          if (typeof chunk === 'string') {
            chunks.push(Buffer.from(chunk));
          }
        });
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(
        `Failed to get file ${key} from bucket ${bucket}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get file as stream
   */
  async getFileStream(
    bucket: string,
    key: string,
  ): Promise<NodeJS.ReadableStream> {
    try {
      return await this.minioClient.getObject(bucket, key);
    } catch (error) {
      this.logger.error(
        `Failed to get file stream ${key} from bucket ${bucket}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(bucket: string, key: string): Promise<any> {
    try {
      return await this.minioClient.statObject(bucket, key);
    } catch (error) {
      this.logger.error(
        `Failed to get file metadata ${key} from bucket ${bucket}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete file from MinIO
   */
  async deleteFile(bucket: string, key: string): Promise<void> {
    try {
      await this.minioClient.removeObject(bucket, key);
      this.logger.log(
        `File deleted successfully: ${key} from bucket ${bucket}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete file ${key} from bucket ${bucket}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Generate a presigned URL for file access
   */
  async getFileUrl(
    bucket: string,
    key: string,
    expiry = 24 * 60 * 60,
  ): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(bucket, key, expiry);
    } catch (error) {
      this.logger.error(
        `Failed to generate URL for ${key} in bucket ${bucket}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  }

  /**
   * Get file extension for programming language
   */
  private getLanguageExtension(language: string): string {
    const extensions: Record<string, string> = {
      cpp: 'cpp',
      c: 'c',
      java: 'java',
      python: 'py',
      javascript: 'js',
    };

    return extensions[language] || 'txt';
  }

  /**
   * Check if bucket exists
   */
  async bucketExists(bucket: string): Promise<boolean> {
    try {
      return await this.minioClient.bucketExists(bucket);
    } catch (error) {
      this.logger.error(`Failed to check if bucket ${bucket} exists`, error);
      return false;
    }
  }
}
