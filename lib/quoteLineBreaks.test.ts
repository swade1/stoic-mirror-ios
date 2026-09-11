import { splitIntoWords, groupWordsIntoLines, indexWordsByLine } from './quoteLineBreaks';

describe('splitIntoWords', () => {
  it('splits on whitespace', () => {
    expect(splitIntoWords('The world is a stage')).toEqual(['The', 'world', 'is', 'a', 'stage']);
  });

  it('collapses multiple spaces', () => {
    expect(splitIntoWords('The   world  is a stage')).toEqual(['The', 'world', 'is', 'a', 'stage']);
  });

  it('trims leading and trailing whitespace', () => {
    expect(splitIntoWords('  The world is a stage  ')).toEqual(['The', 'world', 'is', 'a', 'stage']);
  });

  it('keeps punctuation attached to words', () => {
    expect(splitIntoWords("Nature's fondest, all pass away.")).toEqual([
      "Nature's", 'fondest,', 'all', 'pass', 'away.',
    ]);
  });

  it('returns an empty array for an empty or blank string', () => {
    expect(splitIntoWords('')).toEqual([]);
    expect(splitIntoWords('   ')).toEqual([]);
  });
});

describe('groupWordsIntoLines', () => {
  const words = ['The', 'world', 'is', 'a', 'stage'];

  it('returns one line when there are no breaks', () => {
    expect(groupWordsIntoLines(words, [])).toEqual(['The world is a stage']);
  });

  it('breaks after the given word indices', () => {
    expect(groupWordsIntoLines(words, [1, 3])).toEqual(['The world', 'is a', 'stage']);
  });

  it('breaks after every word when every index is given', () => {
    expect(groupWordsIntoLines(words, [0, 1, 2, 3])).toEqual(['The', 'world', 'is', 'a', 'stage']);
  });

  it('handles unsorted break indices the same as sorted ones', () => {
    expect(groupWordsIntoLines(words, [3, 1])).toEqual(['The world', 'is a', 'stage']);
  });

  it('ignores a break at the last word (would produce a trailing empty line)', () => {
    expect(groupWordsIntoLines(words, [4])).toEqual(['The world is a stage']);
  });

  it('ignores negative and duplicate indices', () => {
    expect(groupWordsIntoLines(words, [-1, 1, 1])).toEqual(['The world', 'is a stage']);
  });

  it('returns an empty array for an empty word list', () => {
    expect(groupWordsIntoLines([], [0, 1])).toEqual([]);
  });

  it('handles a single word with no valid breaks possible', () => {
    expect(groupWordsIntoLines(['Alone'], [0])).toEqual(['Alone']);
  });
});

describe('indexWordsByLine', () => {
  const words = ['The', 'world', 'is', 'a', 'stage'];

  it('returns one line with every word carrying its original index', () => {
    expect(indexWordsByLine(words, [])).toEqual([
      [
        { word: 'The', index: 0 },
        { word: 'world', index: 1 },
        { word: 'is', index: 2 },
        { word: 'a', index: 3 },
        { word: 'stage', index: 4 },
      ],
    ]);
  });

  it('groups the same way as groupWordsIntoLines, just as word objects', () => {
    const grouped = indexWordsByLine(words, [1, 3]);
    expect(grouped.map((line) => line.map((w) => w.word).join(' '))).toEqual(
      groupWordsIntoLines(words, [1, 3])
    );
  });

  it('preserves each word\'s original index across line boundaries', () => {
    const grouped = indexWordsByLine(words, [1, 3]);
    expect(grouped).toEqual([
      [{ word: 'The', index: 0 }, { word: 'world', index: 1 }],
      [{ word: 'is', index: 2 }, { word: 'a', index: 3 }],
      [{ word: 'stage', index: 4 }],
    ]);
  });

  it('returns an empty array for an empty word list', () => {
    expect(indexWordsByLine([], [0])).toEqual([]);
  });
});
