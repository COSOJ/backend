import { Injectable } from '@nestjs/common';
import { ProgrammingLanguage } from '../schema/Submission';

/**
 * Everything the sandbox needs to know to build and run a given language:
 * which image to use, what to name the source file, and the compile/run
 * commands (executed with the working directory set to /workspace).
 */
export interface LanguageSpec {
  language: ProgrammingLanguage;
  /** Docker image tag holding the toolchain. */
  image: string;
  /** Filename the submitted source is written to inside the workspace. */
  sourceFilename: string;
  /**
   * Compile command (argv). Empty/omitted for interpreted languages.
   * Runs inside the container at /workspace.
   */
  compile?: string[];
  /** Run command (argv). Reads stdin, writes stdout. */
  run: string[];
}

const SPECS: Record<ProgrammingLanguage, LanguageSpec> = {
  [ProgrammingLanguage.PYTHON]: {
    language: ProgrammingLanguage.PYTHON,
    image: 'cosoj-judge-python',
    sourceFilename: 'main.py',
    run: ['python3', 'main.py'],
  },
  [ProgrammingLanguage.JAVASCRIPT]: {
    language: ProgrammingLanguage.JAVASCRIPT,
    image: 'cosoj-judge-javascript-v8',
    sourceFilename: 'main.js',
    run: ['node', 'main.js'],
  },
  [ProgrammingLanguage.CPP]: {
    language: ProgrammingLanguage.CPP,
    image: 'cosoj-judge-cpp20',
    sourceFilename: 'main.cpp',
    compile: ['g++', '-O2', '-std=c++20', '-o', 'program', 'main.cpp'],
    run: ['./program'],
  },
  [ProgrammingLanguage.C]: {
    language: ProgrammingLanguage.C,
    image: 'cosoj-judge-gcc',
    sourceFilename: 'main.c',
    compile: ['gcc', '-O2', '-std=c11', '-o', 'program', 'main.c', '-lm'],
    run: ['./program'],
  },
  [ProgrammingLanguage.JAVA]: {
    language: ProgrammingLanguage.JAVA,
    // By convention the user's public class must be named Main.
    image: 'cosoj-judge-java',
    sourceFilename: 'Main.java',
    compile: ['javac', 'Main.java'],
    run: ['java', 'Main'],
  },
};

@Injectable()
export class LanguageRegistry {
  get(language: ProgrammingLanguage): LanguageSpec {
    const spec = SPECS[language];
    if (!spec) {
      throw new Error(`Unsupported language: ${String(language)}`);
    }
    return spec;
  }

  isSupported(language: ProgrammingLanguage): boolean {
    return Boolean(SPECS[language]);
  }

  all(): LanguageSpec[] {
    return Object.values(SPECS);
  }
}
