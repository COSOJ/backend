import { Injectable } from '@nestjs/common';

export enum ComparisonMode {
  /**
   * Whitespace-insensitive: compares the sequence of non-whitespace tokens.
   * This is the default used by most online judges (UVa/Codeforces style) and
   * tolerates trailing spaces, trailing newlines, and CRLF vs LF differences.
   */
  TOKEN = 'token',
  /**
   * Line-by-line exact match after normalizing line endings and stripping
   * trailing whitespace on each line and trailing blank lines. Stricter than
   * TOKEN but still forgiving of the platform newline differences that would
   * otherwise cause spurious wrong-answers.
   */
  EXACT = 'exact',
}

/**
 * Compares expected output against a program's actual output and decides
 * whether they should be considered equal for judging purposes.
 */
@Injectable()
export class OutputComparator {
  compare(
    expected: string,
    actual: string,
    mode: ComparisonMode = ComparisonMode.TOKEN,
  ): boolean {
    if (mode === ComparisonMode.EXACT) {
      return this.exactEquals(expected, actual);
    }
    return this.tokenEquals(expected, actual);
  }

  private tokenEquals(expected: string, actual: string): boolean {
    const a = this.tokenize(expected);
    const b = this.tokenize(actual);
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  private tokenize(value: string): string[] {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }
    return trimmed.split(/\s+/);
  }

  private exactEquals(expected: string, actual: string): boolean {
    return this.normalizeLines(expected) === this.normalizeLines(actual);
  }

  private normalizeLines(value: string): string {
    const lines = value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''));

    // Drop trailing blank lines so a single trailing newline does not matter.
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.join('\n');
  }
}
