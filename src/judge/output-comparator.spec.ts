import { ComparisonMode, OutputComparator } from './output-comparator';

describe('OutputComparator', () => {
  let comparator: OutputComparator;

  beforeEach(() => {
    comparator = new OutputComparator();
  });

  describe('TOKEN mode (default)', () => {
    it('accepts identical output', () => {
      expect(comparator.compare('42', '42')).toBe(true);
    });

    it('ignores trailing newline and trailing spaces', () => {
      expect(comparator.compare('42', '42\n')).toBe(true);
      expect(comparator.compare('42', '42   ')).toBe(true);
      expect(comparator.compare('42\n', '42')).toBe(true);
    });

    it('ignores differences in internal whitespace runs', () => {
      expect(comparator.compare('1 2 3', '1   2\t3')).toBe(true);
      expect(comparator.compare('1 2 3', '1\n2\n3\n')).toBe(true);
    });

    it('tolerates CRLF line endings', () => {
      expect(comparator.compare('a\nb', 'a\r\nb\r\n')).toBe(true);
    });

    it('rejects when a token differs', () => {
      expect(comparator.compare('1 2 3', '1 2 4')).toBe(false);
    });

    it('rejects when token counts differ', () => {
      expect(comparator.compare('1 2', '1 2 3')).toBe(false);
    });

    it('treats two empty outputs as equal', () => {
      expect(comparator.compare('', '   \n  ')).toBe(true);
    });

    it('rejects empty expected against non-empty actual', () => {
      expect(comparator.compare('', 'x')).toBe(false);
    });
  });

  describe('EXACT mode', () => {
    it('accepts line-identical output ignoring trailing newline', () => {
      expect(comparator.compare('a\nb', 'a\nb\n', ComparisonMode.EXACT)).toBe(
        true,
      );
    });

    it('strips trailing whitespace per line', () => {
      expect(comparator.compare('a\nb', 'a  \nb\t', ComparisonMode.EXACT)).toBe(
        true,
      );
    });

    it('rejects when internal spacing differs', () => {
      expect(
        comparator.compare('1 2 3', '1   2   3', ComparisonMode.EXACT),
      ).toBe(false);
    });

    it('rejects when a line differs', () => {
      expect(
        comparator.compare(
          'hello\nworld',
          'hello\nplanet',
          ComparisonMode.EXACT,
        ),
      ).toBe(false);
    });

    it('accepts multi-line output with mixed line endings', () => {
      expect(
        comparator.compare('1\n2\n3', '1\r\n2\r\n3\r\n', ComparisonMode.EXACT),
      ).toBe(true);
    });
  });
});
