import { atomWithStorage } from 'jotai/utils';

export interface Session {
  id: string;
  date: string;
  title: string;
  image?: string;
  summary?: string;
  facts?: string[];
  furtherImpact?: string;
}

export const sessionsAtom = atomWithStorage<Session[]>('sessions', []);

export interface PersonalizationAnswers {
  q1: string;
  q2: string;
  q3: string[];
}

export const personalizationAtom = atomWithStorage<PersonalizationAnswers | null>('personalization', null);
