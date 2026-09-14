import { flattenManualLineBreaks } from './quoteCardText';

describe('flattenManualLineBreaks', () => {
  it('returns text with no line breaks unchanged', () => {
    expect(flattenManualLineBreaks('The world is a stage.')).toBe('The world is a stage.');
  });

  it('collapses a single manual line break into a space', () => {
    expect(flattenManualLineBreaks('The world\nis a stage.')).toBe('The world is a stage.');
  });

  it('collapses several manual line breaks in the same paragraph', () => {
    expect(flattenManualLineBreaks('The\nworld\nis a\nstage.')).toBe('The world is a stage.');
  });

  it('preserves a paragraph break (two or more newlines)', () => {
    expect(flattenManualLineBreaks('The world is a stage.\n\n— Shakespeare')).toBe(
      'The world is a stage.\n\n— Shakespeare'
    );
  });

  it('flattens manual breaks within each paragraph while keeping the paragraph break', () => {
    expect(flattenManualLineBreaks('The world\nis a stage.\n\n— William\nShakespeare')).toBe(
      'The world is a stage.\n\n— William Shakespeare'
    );
  });

  it('treats three or more consecutive newlines the same as a paragraph break', () => {
    expect(flattenManualLineBreaks('One.\n\n\nTwo.')).toBe('One.\n\nTwo.');
  });

  it('trims leading and trailing whitespace within each paragraph', () => {
    expect(flattenManualLineBreaks('  The world\nis a stage.  ')).toBe('The world is a stage.');
  });

  it('returns an empty string unchanged', () => {
    expect(flattenManualLineBreaks('')).toBe('');
  });
});
