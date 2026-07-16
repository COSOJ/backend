import { Injectable, Logger } from '@nestjs/common';
import { appConfig } from '../config/app.config';
import { JudgeService } from './judge.service';

/**
 * In-process, bounded-concurrency work queue for judging. Submissions are
 * judged asynchronously so the HTTP request that created them returns
 * immediately. The {@link ICodeExecutor} abstraction means this can later be
 * swapped for a Redis/Bull-backed distributed queue without touching callers.
 */
@Injectable()
export class JudgeQueue {
  private readonly logger = new Logger(JudgeQueue.name);
  private readonly queue: string[] = [];
  private active = 0;
  private readonly concurrency = Math.max(1, appConfig.judge.concurrency);
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly judgeService: JudgeService) {}

  /** Schedule a submission for judging. No-op when judging is disabled. */
  enqueue(submissionId: string): void {
    if (!appConfig.judge.enabled) {
      this.logger.debug(`Judging disabled; not enqueuing ${submissionId}`);
      return;
    }
    this.queue.push(submissionId);
    this.pump();
  }

  /** Resolves once every queued submission has finished judging. */
  onIdle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const submissionId = this.queue.shift() as string;
      this.active++;
      void this.judgeService
        .judge(submissionId)
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Unhandled judge error for ${submissionId}: ${message}`,
          );
        })
        .finally(() => {
          this.active--;
          this.pump();
          if (this.active === 0 && this.queue.length === 0) {
            const resolvers = this.idleResolvers;
            this.idleResolvers = [];
            resolvers.forEach((resolve) => resolve());
          }
        });
    }
  }
}
