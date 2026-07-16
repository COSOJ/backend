import { LanguageRegistry } from './language.registry';
import { ProgrammingLanguage } from '../schema/Submission';

describe('LanguageRegistry', () => {
  let registry: LanguageRegistry;

  beforeEach(() => {
    registry = new LanguageRegistry();
  });

  it('provides a spec for every supported language enum value', () => {
    for (const language of Object.values(ProgrammingLanguage)) {
      const spec = registry.get(language);
      expect(spec.language).toBe(language);
      expect(spec.image).toMatch(/^cosoj-judge-/);
      expect(spec.sourceFilename.length).toBeGreaterThan(0);
      expect(Array.isArray(spec.run)).toBe(true);
      expect(spec.run.length).toBeGreaterThan(0);
    }
  });

  it('marks compiled languages with a compile command and interpreted ones without', () => {
    expect(registry.get(ProgrammingLanguage.CPP).compile).toBeDefined();
    expect(registry.get(ProgrammingLanguage.C).compile).toBeDefined();
    expect(registry.get(ProgrammingLanguage.JAVA).compile).toBeDefined();
    expect(registry.get(ProgrammingLanguage.PYTHON).compile).toBeUndefined();
    expect(
      registry.get(ProgrammingLanguage.JAVASCRIPT).compile,
    ).toBeUndefined();
  });

  it('uses Main.java + java Main for Java by convention', () => {
    const java = registry.get(ProgrammingLanguage.JAVA);
    expect(java.sourceFilename).toBe('Main.java');
    expect(java.run).toEqual(['java', 'Main']);
  });

  it('reports supported languages', () => {
    expect(registry.isSupported(ProgrammingLanguage.PYTHON)).toBe(true);
    expect(registry.isSupported('brainfuck' as ProgrammingLanguage)).toBe(
      false,
    );
  });

  it('throws for an unsupported language', () => {
    expect(() => registry.get('cobol' as ProgrammingLanguage)).toThrow(
      /Unsupported language/,
    );
  });

  it('lists all specs', () => {
    expect(registry.all()).toHaveLength(
      Object.values(ProgrammingLanguage).length,
    );
  });
});
