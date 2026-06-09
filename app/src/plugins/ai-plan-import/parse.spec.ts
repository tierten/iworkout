import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';

import {
  CardioExerciseBlueprint,
  CardioExerciseSetBlueprint,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { AiWorkoutPlan } from '@/models/ai-models';
import {
  PLAN_CODE_PREFIX,
  PlanImportError,
  decodePlanCode,
  encodePlanCode,
  parsePlanJson,
} from './parse';

function samplePlan(name = 'Test Plan'): AiWorkoutPlan {
  return {
    name,
    description: 'A two-day split',
    sessions: [
      new SessionBlueprint(
        'Push',
        [
          WeightedExerciseBlueprint.empty().with({
            name: 'Bench Press',
            sets: 3,
            repsPerSet: 5,
            weightIncreaseOnSuccess: new BigNumber(2.5),
          }),
        ],
        'Chest day notes',
      ),
      new SessionBlueprint(
        'Cardio',
        [
          CardioExerciseBlueprint.empty().with({
            name: 'Treadmill Run',
            sets: [
              CardioExerciseSetBlueprint.empty().with({
                target: {
                  type: 'distance',
                  value: { value: new BigNumber(5), unit: 'kilometre' },
                },
              }),
            ],
          }),
        ],
        '',
      ),
    ],
  };
}

function expectPlansEqual(a: AiWorkoutPlan, b: AiWorkoutPlan) {
  expect(a.name).toBe(b.name);
  expect(a.description).toBe(b.description);
  expect(a.sessions.length).toBe(b.sessions.length);
  a.sessions.forEach((session, i) => {
    expect(session.equals(b.sessions[i])).toBe(true);
  });
}

describe('plan code round-trip', () => {
  it('encodes and decodes a weighted + cardio plan', () => {
    const plan = samplePlan();
    const parsed = parsePlanJson(decodePlanCode(encodePlanCode(plan)));
    expectPlansEqual(parsed, plan);
  });

  it('produces a code with the LLPLAN1 prefix', () => {
    expect(encodePlanCode(samplePlan()).startsWith(PLAN_CODE_PREFIX)).toBe(true);
  });

  it('accepts a code without the prefix', () => {
    const code = encodePlanCode(samplePlan()).slice(PLAN_CODE_PREFIX.length);
    const parsed = parsePlanJson(decodePlanCode(code));
    expectPlansEqual(parsed, samplePlan());
  });

  it('tolerates surrounding whitespace / line breaks', () => {
    const code = `\n  ${encodePlanCode(samplePlan())}  \n`;
    const parsed = parsePlanJson(decodePlanCode(code));
    expectPlansEqual(parsed, samplePlan());
  });

  it('preserves non-ASCII names', () => {
    const plan = samplePlan('Πρόγραμμα 💪 Кроссфит');
    const parsed = parsePlanJson(decodePlanCode(encodePlanCode(plan)));
    expect(parsed.name).toBe('Πρόγραμμα 💪 Кроссфит');
  });

  it('accepts raw JSON pasted directly', () => {
    const json = JSON.stringify({
      name: 'Raw',
      description: '',
      sessions: [
        {
          name: 'Day 1',
          notes: '',
          exercises: [
            {
              name: 'Squat',
              sets: 5,
              repsPerSet: 5,
              weightIncreaseOnSuccess: 2.5,
              supersetWithNext: false,
              notes: '',
              link: '',
              restBetweenSets: {
                minRest: '00:01:30',
                maxRest: '00:03:00',
                failureRest: '00:05:00',
              },
            },
          ],
        },
      ],
    });
    const parsed = parsePlanJson(decodePlanCode(json));
    expect(parsed.name).toBe('Raw');
    expect(parsed.sessions[0].exercises[0].name).toBe('Squat');
  });
});

describe('error handling', () => {
  it('rejects empty input', () => {
    expect(() => decodePlanCode('   ')).toThrow(PlanImportError);
  });

  it('rejects non-JSON garbage', () => {
    expect(() => decodePlanCode('not a real code!!!')).toThrow(PlanImportError);
  });

  it('rejects a plan missing its name', () => {
    expect(() => parsePlanJson({ sessions: [] })).toThrow(PlanImportError);
  });

  it('rejects a plan with no workouts', () => {
    expect(() => parsePlanJson({ name: 'x', sessions: [] })).toThrow(
      /no workouts/i,
    );
  });

  it('rejects an invalid duration', () => {
    const bad = {
      name: 'x',
      sessions: [
        {
          name: 'd',
          exercises: [
            {
              name: 'Bench',
              sets: 3,
              repsPerSet: 5,
              restBetweenSets: { minRest: 'PT1M30S', maxRest: '00:03:00', failureRest: '00:05:00' },
            },
          ],
        },
      ],
    };
    expect(() => parsePlanJson(bad)).toThrow(/duration/i);
  });

  it('rejects an invalid distance unit', () => {
    const bad = {
      name: 'x',
      sessions: [
        {
          name: 'd',
          exercises: [
            {
              name: 'Run',
              sets: [
                { target: { type: 'distance', value: { value: 5, unit: 'lightyears' } } },
              ],
            },
          ],
        },
      ],
    };
    expect(() => parsePlanJson(bad)).toThrow(/distance unit/i);
  });

  it('rejects a weighted exercise with a non-numeric set count', () => {
    const bad = {
      name: 'x',
      sessions: [
        {
          name: 'd',
          exercises: [{ name: 'Bench', sets: 'three', repsPerSet: 5 }],
        },
      ],
    };
    expect(() => parsePlanJson(bad)).toThrow(PlanImportError);
  });
});
