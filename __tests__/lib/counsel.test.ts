import { CONCERN_OPTIONS } from '../../lib/concerns';
import {
  BURST_LIMIT,
  CATEGORIES,
  DAILY_LIMIT,
  MAX_CONCERN_LENGTH,
  SYSTEM_PROMPT,
  buildUserMessage,
  decideLimit,
  parseCounsel,
  validateConcern,
  type Passage,
} from '../../supabase/functions/seek-counsel/counsel';

const passages: Passage[] = [
  {
    id: 'p1',
    author: 'Marcus Aurelius',
    work: 'Meditations',
    section: '4.3',
    passage: 'You have power over your mind.',
    concern_tags: ['Anger', 'Resilience'],
  },
  {
    id: 'p2',
    author: 'Seneca',
    work: 'Letters',
    section: null,
    passage: 'We suffer more in imagination than in reality.',
    concern_tags: ['Fear & Anxiety'],
  },
];

describe('seek-counsel categories', () => {
  it('match the app concern vocabulary exactly', () => {
    expect([...CATEGORIES]).toEqual([...CONCERN_OPTIONS]);
  });

  it('are all listed in the system prompt', () => {
    CATEGORIES.forEach((c) => expect(SYSTEM_PROMPT).toContain(c));
  });
});

describe('validateConcern', () => {
  it('trims and accepts normal text', () => {
    expect(validateConcern('  I am angry  ')).toBe('I am angry');
  });

  it('rejects non-strings, blanks and overlong text', () => {
    expect(validateConcern(undefined)).toBeNull();
    expect(validateConcern(42)).toBeNull();
    expect(validateConcern('   ')).toBeNull();
    expect(validateConcern('x'.repeat(MAX_CONCERN_LENGTH + 1))).toBeNull();
    expect(validateConcern('x'.repeat(MAX_CONCERN_LENGTH))).not.toBeNull();
  });
});

describe('decideLimit', () => {
  it('allows requests under both limits', () => {
    expect(decideLimit(BURST_LIMIT - 1, DAILY_LIMIT - 1)).toBe('ok');
  });

  it('blocks at the burst limit', () => {
    expect(decideLimit(BURST_LIMIT, 5)).toBe('burst');
  });

  it('blocks at the daily limit', () => {
    expect(decideLimit(0, DAILY_LIMIT)).toBe('daily');
  });

  it('reports burst before daily when both are exceeded', () => {
    expect(decideLimit(BURST_LIMIT, DAILY_LIMIT)).toBe('burst');
  });
});

describe('buildUserMessage', () => {
  it('numbers passages and includes section when present', () => {
    const msg = buildUserMessage('help', passages, []);
    expect(msg).toContain('[1] Marcus Aurelius — Meditations, 4.3');
    expect(msg).toContain('[2] Seneca — Letters\n');
    expect(msg).not.toContain('ongoing concerns');
  });

  it('adds standing concerns as background', () => {
    const msg = buildUserMessage('help', passages, ['Anger']);
    expect(msg).toContain('ongoing concerns include: Anger');
  });
});

describe('parseCounsel', () => {
  const reply = (obj: unknown, fence = false) =>
    fence ? '```json\n' + JSON.stringify(obj) + '\n```' : JSON.stringify(obj);

  const base = {
    quotes: [
      {
        quote: 'You have power over your mind.',
        author: 'Marcus Aurelius',
        source: 'Meditations',
        interpretation: 'Take it back.',
      },
    ],
    category: 'Anger',
  };

  it('maps a quote to its passage id and matched concern', () => {
    const result = parseCounsel(reply(base), passages, ['Resilience']);
    expect(result.category).toBe('Anger');
    expect(result.quotes[0].passage_id).toBe('p1');
    expect(result.quotes[0].matched_concern).toBe('Resilience');
  });

  it('tolerates code fences', () => {
    expect(parseCounsel(reply(base, true), passages, []).quotes).toHaveLength(1);
  });

  it('leaves ids null when the quote is not a candidate', () => {
    const odd = { ...base, quotes: [{ ...base.quotes[0], quote: 'Invented' }] };
    const q = parseCounsel(reply(odd), passages, ['Anger']).quotes[0];
    expect(q.passage_id).toBeNull();
    expect(q.matched_concern).toBeNull();
  });

  it('falls back to General for an unknown category', () => {
    const bad = { ...base, category: 'Banana' };
    expect(parseCounsel(reply(bad), passages, []).category).toBe('General');
  });

  it('keeps at most five quotes', () => {
    const many = { ...base, quotes: Array(8).fill(base.quotes[0]) };
    expect(parseCounsel(reply(many), passages, []).quotes).toHaveLength(5);
  });

  it('throws on malformed replies', () => {
    expect(() => parseCounsel('not json', passages, [])).toThrow();
    expect(() => parseCounsel(reply({ quotes: [] }), passages, [])).toThrow();
  });
});
