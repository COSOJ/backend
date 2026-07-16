import { ProgrammingLanguage } from '../schema/Submission';

/**
 * Low-level outcome of running a single program invocation inside the sandbox.
 * This is intentionally decoupled from {@link SubmissionVerdict}: the executor
 * only reports *what happened mechanically*, and the JudgeService is responsible
 * for turning that (plus output comparison) into a verdict.
 */
export enum ExecutionStatus {
  /** Program ran to completion with exit code 0. */
  OK = 'ok',
  /** Compilation step failed. */
  COMPILE_ERROR = 'compile_error',
  /** Program exited with a non-zero status or was killed by a signal. */
  RUNTIME_ERROR = 'runtime_error',
  /** Program exceeded the wall-clock time limit and was killed. */
  TIME_LIMIT_EXCEEDED = 'time_limit_exceeded',
  /** Program exceeded the memory limit (OOM killed by the sandbox). */
  MEMORY_LIMIT_EXCEEDED = 'memory_limit_exceeded',
  /** The sandbox itself failed (docker missing, image missing, I/O error, ...). */
  INTERNAL_ERROR = 'internal_error',
}

export interface ExecutionLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface CompileResult {
  success: boolean;
  /** Compiler diagnostics (only meaningful when {@link success} is false). */
  stderr: string;
  timeMs: number;
}

export interface RunResult {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  /** Wall-clock time consumed by the program, in milliseconds. */
  timeMs: number;
  /** Peak resident memory, in kilobytes (0 when the sandbox cannot measure it). */
  memoryKb: number;
}

/**
 * A program that has been prepared (source written, and compiled for compiled
 * languages) and is ready to be executed against many test cases. Opaque handle
 * whose concrete shape is owned by the executor implementation.
 */
export interface PreparedProgram {
  id: string;
  language: ProgrammingLanguage;
  workdir: string;
}

export interface PrepareResult {
  compile: CompileResult;
  /** Present only when compilation succeeded. */
  program?: PreparedProgram;
}

/**
 * Abstraction over "a place that can compile and run untrusted code against
 * input under time/memory limits". The Docker implementation is the production
 * sandbox; tests provide in-memory stubs so judging logic can be verified
 * without spinning containers.
 */
export interface ICodeExecutor {
  prepare(
    language: ProgrammingLanguage,
    sourceCode: string,
  ): Promise<PrepareResult>;

  run(
    program: PreparedProgram,
    stdin: string,
    limits: ExecutionLimits,
  ): Promise<RunResult>;

  cleanup(program: PreparedProgram): Promise<void>;
}

/** DI token for {@link ICodeExecutor}. */
export const CODE_EXECUTOR = Symbol('CODE_EXECUTOR');
