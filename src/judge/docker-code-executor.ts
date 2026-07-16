import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { appConfig } from '../config/app.config';
import { ProgrammingLanguage } from '../schema/Submission';
import { LanguageRegistry } from './language.registry';
import {
  CompileResult,
  ExecutionLimits,
  ExecutionStatus,
  ICodeExecutor,
  PrepareResult,
  PreparedProgram,
  RunResult,
} from './code-executor.interface';

interface DockerRunOutcome {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  /** True when our wall-clock watchdog killed the container. */
  timedOut: boolean;
  /** True when the docker binary could not be spawned at all. */
  spawnFailed: boolean;
  wallMs: number;
}

type DockerRunResult = DockerRunOutcome & { oomKilled: boolean };

const STATS_FILE = 'cosoj_stats.txt';

/**
 * Production sandbox: compiles and runs untrusted code inside per-language
 * Docker containers with no network, a memory cap, a pids cap and a wall-clock
 * watchdog. Resource usage is measured with GNU `/usr/bin/time -v` inside the
 * container; OOM kills are detected via `docker inspect`.
 */
@Injectable()
export class DockerCodeExecutor implements ICodeExecutor {
  private readonly logger = new Logger(DockerCodeExecutor.name);
  private readonly docker = appConfig.judge.dockerBinary;

  constructor(private readonly registry: LanguageRegistry) {}

  async prepare(
    language: ProgrammingLanguage,
    sourceCode: string,
  ): Promise<PrepareResult> {
    const spec = this.registry.get(language);
    const base = appConfig.judge.workdir;
    await fs.mkdir(base, { recursive: true });
    const workdir = await fs.mkdtemp(path.join(base, 'cosoj-judge-'));
    // The sandbox runs as a non-root user, so it must be able to write compiled
    // artifacts and the timing stats file into the mounted workspace.
    await fs.chmod(workdir, 0o777);
    await fs.writeFile(path.join(workdir, spec.sourceFilename), sourceCode);

    const program: PreparedProgram = { id: uuidv4(), language, workdir };

    if (!spec.compile || spec.compile.length === 0) {
      return { compile: { success: true, stderr: '', timeMs: 0 }, program };
    }

    const started = Date.now();
    const outcome = await this.dockerRun({
      image: spec.image,
      argv: spec.compile,
      workdir,
      memoryLimitMb: appConfig.judge.compileMemoryMb,
      killAfterMs: appConfig.judge.compileTimeoutMs,
      useTimeWrapper: false,
    });
    const timeMs = Date.now() - started;

    if (outcome.spawnFailed) {
      await this.cleanup(program);
      throw new Error('Sandbox unavailable: failed to spawn docker');
    }

    if (outcome.exitCode !== 0 || outcome.timedOut) {
      await this.cleanup(program);
      const stderr = outcome.timedOut
        ? `Compilation timed out after ${appConfig.judge.compileTimeoutMs}ms`
        : outcome.stderr || 'Compilation failed';
      const compile: CompileResult = { success: false, stderr, timeMs };
      return { compile };
    }

    return { compile: { success: true, stderr: '', timeMs }, program };
  }

  async run(
    program: PreparedProgram,
    stdin: string,
    limits: ExecutionLimits,
  ): Promise<RunResult> {
    const spec = this.registry.get(program.language);
    // Clear any stats file left over from a previous run.
    await fs
      .rm(path.join(program.workdir, STATS_FILE), { force: true })
      .catch(() => undefined);

    // The watchdog is a generous wall-clock safety net; the real time limit is
    // enforced on CPU time (see classify) so load-induced wall inflation does
    // not cause false TLEs.
    const killAfterMs =
      limits.timeLimitMs * appConfig.judge.wallMultiplier +
      appConfig.judge.startupGraceMs;

    const outcome = await this.dockerRun({
      image: spec.image,
      argv: spec.run,
      workdir: program.workdir,
      memoryLimitMb: limits.memoryLimitMb,
      killAfterMs,
      stdin,
      useTimeWrapper: true,
    });

    if (outcome.spawnFailed) {
      return this.internalError('failed to spawn docker');
    }

    const stats = await this.readStats(program.workdir);
    const memoryKb = stats.memoryKb;
    // Report CPU time as the authoritative "time used"; fall back to measured
    // wall time only when stats are unavailable (e.g. the process was killed).
    const timeMs = stats.cpuMs ?? stats.elapsedMs ?? outcome.wallMs;

    const status = this.classify(outcome, memoryKb, stats.cpuMs, limits);

    return {
      status,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      timeMs,
      memoryKb,
    };
  }

  async cleanup(program: PreparedProgram): Promise<void> {
    await fs
      .rm(program.workdir, { recursive: true, force: true })
      .catch((err) =>
        this.logger.warn(`Failed to clean workdir ${program.workdir}: ${err}`),
      );
  }

  private classify(
    outcome: DockerRunResult,
    memoryKb: number,
    cpuMs: number | null,
    limits: ExecutionLimits,
  ): ExecutionStatus {
    if (outcome.timedOut) {
      return ExecutionStatus.TIME_LIMIT_EXCEEDED;
    }
    // 125 == docker daemon/config error (e.g. image missing); 137 with our
    // watchdog is handled above, otherwise 137 usually means an OOM kill.
    if (outcome.exitCode === 125) {
      return ExecutionStatus.INTERNAL_ERROR;
    }
    if (outcome.oomKilled) {
      return ExecutionStatus.MEMORY_LIMIT_EXCEEDED;
    }
    if (memoryKb > 0 && memoryKb > limits.memoryLimitMb * 1024) {
      return ExecutionStatus.MEMORY_LIMIT_EXCEEDED;
    }
    // Enforce the time limit on CPU time so a program that merely waited (CPU
    // starved under concurrent load) is not falsely failed.
    if (cpuMs !== null && cpuMs > limits.timeLimitMs) {
      return ExecutionStatus.TIME_LIMIT_EXCEEDED;
    }
    if (outcome.exitCode !== 0 || outcome.signal) {
      return ExecutionStatus.RUNTIME_ERROR;
    }
    return ExecutionStatus.OK;
  }

  private internalError(reason: string): RunResult {
    return {
      status: ExecutionStatus.INTERNAL_ERROR,
      stdout: '',
      stderr: reason,
      exitCode: null,
      signal: null,
      timeMs: 0,
      memoryKb: 0,
    };
  }

  private async dockerRun(opts: {
    image: string;
    argv: string[];
    workdir: string;
    memoryLimitMb: number;
    killAfterMs: number;
    stdin?: string;
    useTimeWrapper: boolean;
  }): Promise<DockerRunResult> {
    const containerName = `cosoj-run-${uuidv4()}`;
    const memArg = `${opts.memoryLimitMb}m`;

    const dockerArgs = [
      'run',
      '--name',
      containerName,
      '-i',
      '--network=none',
      `--memory=${memArg}`,
      `--memory-swap=${memArg}`,
      '--cpus=1',
      `--pids-limit=${appConfig.judge.pidsLimit}`,
      '-v',
      `${opts.workdir}:/workspace`,
      '-w',
      '/workspace',
    ];

    let commandArgv = opts.argv;
    if (opts.useTimeWrapper) {
      dockerArgs.push('--entrypoint', '/usr/bin/time');
      commandArgv = ['-v', '-o', `/workspace/${STATS_FILE}`, ...opts.argv];
    }
    dockerArgs.push(opts.image, ...commandArgv);

    const outcome = await this.spawnDocker(
      dockerArgs,
      opts.stdin,
      opts.killAfterMs,
      containerName,
    );

    const oomKilled = await this.inspectOom(containerName);
    await this.removeContainer(containerName);

    return { ...outcome, oomKilled };
  }

  private spawnDocker(
    args: string[],
    stdin: string | undefined,
    killAfterMs: number,
    containerName: string,
  ): Promise<DockerRunOutcome> {
    return new Promise((resolve) => {
      const started = Date.now();
      const child = spawn(this.docker, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      let spawnFailed = false;
      let settled = false;

      const watchdog = setTimeout(() => {
        timedOut = true;
        // Kill the container from the outside; SIGKILL its process tree.
        const killer = spawn(this.docker, ['kill', containerName]);
        killer.on('error', () => undefined);
      }, killAfterMs);

      child.stdout.on('data', (d: Buffer) => stdoutChunks.push(d));
      child.stderr.on('data', (d: Buffer) => stderrChunks.push(d));

      child.on('error', () => {
        spawnFailed = true;
      });

      child.on('close', (code, signal) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(watchdog);
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
          stderr: Buffer.concat(stderrChunks).toString('utf-8'),
          exitCode: code,
          signal: signal,
          timedOut,
          spawnFailed,
          wallMs: Date.now() - started,
        });
      });

      if (stdin !== undefined) {
        child.stdin.write(stdin);
      }
      child.stdin.end();
    });
  }

  private async inspectOom(containerName: string): Promise<boolean> {
    try {
      const out = await this.captureCommand([
        'inspect',
        containerName,
        '--format',
        '{{.State.OOMKilled}}',
      ]);
      return out.trim() === 'true';
    } catch {
      return false;
    }
  }

  private async removeContainer(containerName: string): Promise<void> {
    await this.captureCommand(['rm', '-f', containerName]).catch(
      () => undefined,
    );
  }

  private captureCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.docker, args, {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const chunks: Buffer[] = [];
      child.stdout.on('data', (d: Buffer) => chunks.push(d));
      child.on('error', reject);
      child.on('close', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
  }

  private async readStats(workdir: string): Promise<{
    memoryKb: number;
    cpuMs: number | null;
    elapsedMs: number | null;
  }> {
    try {
      const content = await fs.readFile(
        path.join(workdir, STATS_FILE),
        'utf-8',
      );
      return this.parseTimeV(content);
    } catch {
      return { memoryKb: 0, cpuMs: null, elapsedMs: null };
    }
  }

  /** Parse the output of `/usr/bin/time -v`. */
  private parseTimeV(content: string): {
    memoryKb: number;
    cpuMs: number | null;
    elapsedMs: number | null;
  } {
    let memoryKb = 0;
    let elapsedMs: number | null = null;

    const memMatch = content.match(
      /Maximum resident set size \(kbytes\):\s*(\d+)/,
    );
    if (memMatch) {
      memoryKb = parseInt(memMatch[1], 10);
    }

    const elapsedMatch = content.match(
      /Elapsed \(wall clock\) time[^:]*:\s*([0-9:.]+)/,
    );
    if (elapsedMatch) {
      elapsedMs = this.parseElapsedToMs(elapsedMatch[1]);
    }

    // CPU time = user + system time; this is what the time limit is enforced on.
    const userMatch = content.match(/User time \(seconds\):\s*([0-9.]+)/);
    const sysMatch = content.match(/System time \(seconds\):\s*([0-9.]+)/);
    let cpuMs: number | null = null;
    if (userMatch || sysMatch) {
      const user = userMatch ? parseFloat(userMatch[1]) : 0;
      const sys = sysMatch ? parseFloat(sysMatch[1]) : 0;
      cpuMs = Math.round((user + sys) * 1000);
    }

    return { memoryKb, cpuMs, elapsedMs };
  }

  private parseElapsedToMs(value: string): number {
    const parts = value.split(':').map((p) => parseFloat(p));
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else {
      seconds = parts[0];
    }
    return Math.round(seconds * 1000);
  }
}
