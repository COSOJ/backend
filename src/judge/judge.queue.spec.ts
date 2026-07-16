import { JudgeQueue } from './judge.queue';
import { JudgeService } from './judge.service';

describe('JudgeQueue', () => {
  function makeService(): {
    service: JudgeService;
    judged: string[];
    resolvers: Array<() => void>;
  } {
    const judged: string[] = [];
    const resolvers: Array<() => void> = [];
    const service = {
      judge: jest.fn((id: string) => {
        judged.push(id);
        return new Promise<void>((resolve) => resolvers.push(resolve));
      }),
    } as unknown as JudgeService;
    return { service, judged, resolvers };
  }

  it('judges an enqueued submission', async () => {
    const { service, judged, resolvers } = makeService();
    const queue = new JudgeQueue(service);

    queue.enqueue('sub-1');
    expect(judged).toEqual(['sub-1']);

    resolvers.forEach((r) => r());
    await queue.onIdle();
  });

  it('processes multiple submissions and drains to idle', async () => {
    const { service, judged, resolvers } = makeService();
    const queue = new JudgeQueue(service);

    queue.enqueue('a');
    queue.enqueue('b');
    queue.enqueue('c');

    // Resolve all in-flight judges; onIdle should settle once drained.
    const idle = queue.onIdle();
    // Resolve repeatedly because concurrency may release new work in waves.
    for (let i = 0; i < 10; i++) {
      resolvers.splice(0).forEach((r) => r());
      await Promise.resolve();
    }
    await idle;

    expect(judged.sort()).toEqual(['a', 'b', 'c']);
  });

  it('resolves onIdle immediately when nothing is queued', async () => {
    const { service } = makeService();
    const queue = new JudgeQueue(service);
    await expect(queue.onIdle()).resolves.toBeUndefined();
  });
});
