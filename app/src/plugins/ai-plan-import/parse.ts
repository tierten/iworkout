/**
 * AI plan import — decode / validate / convert a pasted plan code.
 *
 * This module is intentionally self-contained so the feature can be added
 * without modifying existing source. The JSON -> domain conversion mirrors
 * `toAiWorkoutPlan` / `parseAiExercise` in
 * `@/services/ai-chat-service.ts` — keep the two in sync if the plan shape
 * ever changes. The difference here is that the input is *untrusted pasted
 * text*, so every field is validated and failures throw a `PlanImportError`
 * with a human-friendly message.
 *
 * Wire format of a plan code:
 *   "LLPLAN1:" + base64( utf8( JSON.stringify(plan) ) )
 * Raw JSON (a string starting with "{") is also accepted for convenience.
 */
import { Duration } from '@js-joda/core';
import BigNumber from 'bignumber.js';
import { match, P } from 'ts-pattern';

import { AiWorkoutPlan } from '@/models/ai-models';
import {
  CardioExerciseBlueprint,
  CardioExerciseSetBlueprint,
  CardioTarget,
  DistanceUnit,
  DistanceUnits,
  ExerciseBlueprint,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { parseDuration } from '@/utils/format-date';

export const PLAN_CODE_PREFIX = 'LLPLAN1:';

/** Thrown when a pasted plan code cannot be decoded or fails validation. */
export class PlanImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanImportError';
  }
}

// ---------------------------------------------------------------------------
// Encoding (used for tests, doc fixtures, and any future "share" affordance)
// ---------------------------------------------------------------------------

/** UTF-8 safe base64 — `btoa`/`atob` are Latin1-only. */
function utf8ToBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function base64ToUtf8(value: string): string {
  return decodeURIComponent(escape(atob(value)));
}

/**
 * Formats a duration as the C# TimeSpan string accepted by `parseDuration`:
 * `d.hh:mm:ss` (the leading `d.` is only emitted when there are whole days).
 */
function formatTimeSpan(duration: Duration): string {
  const totalSeconds = Math.max(0, Math.floor(duration.toMillis() / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const base = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}.${base}` : base;
}

function exerciseToJson(exercise: ExerciseBlueprint): unknown {
  return match(exercise)
    .with(P.instanceOf(WeightedExerciseBlueprint), (w) => ({
      type: 'WeightedExerciseBlueprint',
      name: w.name,
      sets: w.sets,
      repsPerSet: w.repsPerSet,
      weightIncreaseOnSuccess: w.weightIncreaseOnSuccess.toNumber(),
      restBetweenSets: {
        minRest: formatTimeSpan(w.restBetweenSets.minRest),
        maxRest: formatTimeSpan(w.restBetweenSets.maxRest),
        failureRest: formatTimeSpan(w.restBetweenSets.failureRest),
      },
      supersetWithNext: w.supersetWithNext,
      notes: w.notes,
      link: w.link,
    }))
    .with(P.instanceOf(CardioExerciseBlueprint), (c) => ({
      type: 'CardioExerciseBlueprint',
      name: c.name,
      notes: c.notes,
      link: c.link,
      sets: c.sets.map((s) => ({
        target:
          s.target.type === 'time'
            ? { type: 'time', value: formatTimeSpan(s.target.value) }
            : {
                type: 'distance',
                value: {
                  value: s.target.value.value.toNumber(),
                  unit: s.target.value.unit,
                },
              },
        trackDistance: s.trackDistance,
        trackDuration: s.trackDuration,
        trackIncline: s.trackIncline,
        trackResistance: s.trackResistance,
        trackWeight: s.trackWeight,
        trackSteps: s.trackSteps,
      })),
    }))
    .exhaustive();
}

/** Serialises a plan to its plain-JSON wire shape (no prefix, not encoded). */
export function planToJson(plan: AiWorkoutPlan): unknown {
  return {
    name: plan.name,
    description: plan.description,
    sessions: plan.sessions.map((s) => ({
      name: s.name,
      notes: s.notes,
      exercises: s.exercises.map(exerciseToJson),
    })),
  };
}

/** Produces a pasteable `LLPLAN1:` plan code from a plan. */
export function encodePlanCode(plan: AiWorkoutPlan): string {
  return PLAN_CODE_PREFIX + utf8ToBase64(JSON.stringify(planToJson(plan)));
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

/** Decodes a pasted plan code to raw JSON. Does not validate the shape. */
export function decodePlanCode(code: string): unknown {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new PlanImportError('The plan code is empty.');
  }

  // Convenience: allow raw JSON to be pasted directly.
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new PlanImportError('The plan code could not be read as JSON.');
    }
  }

  const compact = trimmed.replace(/\s+/g, '');
  const base64 = compact.startsWith(PLAN_CODE_PREFIX)
    ? compact.slice(PLAN_CODE_PREFIX.length)
    : compact;

  let json: string;
  try {
    json = base64ToUtf8(base64);
  } catch {
    throw new PlanImportError(
      "This doesn't look like a valid plan code. Make sure you copied the whole thing.",
    );
  }

  try {
    return JSON.parse(json);
  } catch {
    throw new PlanImportError('The plan code could not be read as JSON.');
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function fail(message: string): never {
  throw new PlanImportError(message);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`Expected ${what} to be an object.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    fail(`Expected ${what} to be text.`);
  }
  return value;
}

function optString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`Expected ${what} to be a number.`);
  }
  return value;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`Expected ${what} to be a list.`);
  }
  return value;
}

function optBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseDurationField(value: unknown, what: string): Duration {
  const raw = asString(value, what);
  try {
    return parseDuration(raw);
  } catch {
    return fail(
      `${what} is not a valid duration. Use the format HH:MM:SS, e.g. "00:01:30".`,
    );
  }
}

// ---------------------------------------------------------------------------
// JSON -> domain
// ---------------------------------------------------------------------------

/**
 * Validates and converts decoded JSON into an `AiWorkoutPlan`.
 * Mirrors `toAiWorkoutPlan` in ai-chat-service.ts, with defensive checks.
 */
export function parsePlanJson(value: unknown): AiWorkoutPlan {
  const root = asRecord(value, 'the plan');
  const name = asString(root.name, 'the plan name');
  const sessionsJson = asArray(root.sessions, 'the plan workouts');
  if (sessionsJson.length === 0) {
    fail('The plan has no workouts.');
  }
  return {
    name,
    description: optString(root.description),
    sessions: sessionsJson.map((s, i) => parseSession(s, i)),
  };
}

function parseSession(value: unknown, index: number): SessionBlueprint {
  const session = asRecord(value, `workout #${index + 1}`);
  const name = asString(session.name, `the name of workout #${index + 1}`);
  const exercisesJson = asArray(session.exercises, `the exercises of "${name}"`);
  return new SessionBlueprint(
    name,
    exercisesJson.map((e, i) => parseExercise(e, name, i)),
    optString(session.notes),
  );
}

function parseExercise(
  value: unknown,
  sessionName: string,
  index: number,
): ExerciseBlueprint {
  const where = `exercise #${index + 1} in "${sessionName}"`;
  const exercise = asRecord(value, where);

  // Discriminate exactly as ai-chat-service.ts does: weighted exercises have
  // a `repsPerSet`; everything else is treated as cardio.
  if ('repsPerSet' in exercise) {
    return WeightedExerciseBlueprint.empty().with({
      name: asString(exercise.name, `the name of ${where}`),
      notes: optString(exercise.notes),
      link: optString(exercise.link),
      sets: asNumber(exercise.sets, `the set count of ${where}`),
      repsPerSet: asNumber(exercise.repsPerSet, `the reps of ${where}`),
      supersetWithNext: optBoolean(exercise.supersetWithNext, false),
      weightIncreaseOnSuccess:
        'weightIncreaseOnSuccess' in exercise
          ? new BigNumber(
              asNumber(
                exercise.weightIncreaseOnSuccess,
                `the weight increase of ${where}`,
              ),
            )
          : new BigNumber(0),
      restBetweenSets: parseRest(exercise.restBetweenSets, where),
    });
  }

  const setsJson = asArray(exercise.sets, `the sets of ${where}`);
  if (setsJson.length === 0) {
    fail(`${where} has no sets.`);
  }
  return CardioExerciseBlueprint.empty().with({
    name: asString(exercise.name, `the name of ${where}`),
    notes: optString(exercise.notes),
    link: optString(exercise.link),
    sets: setsJson.map((set, i) => parseCardioSet(set, where, i)),
  });
}

function parseRest(value: unknown, where: string): Rest {
  if (value === undefined || value === null) {
    return Rest.medium;
  }
  const rest = asRecord(value, `the rest of ${where}`);
  return {
    minRest: parseDurationField(rest.minRest, `the min rest of ${where}`),
    maxRest: parseDurationField(rest.maxRest, `the max rest of ${where}`),
    failureRest: parseDurationField(
      rest.failureRest,
      `the failure rest of ${where}`,
    ),
  };
}

function parseCardioSet(
  value: unknown,
  where: string,
  index: number,
): CardioExerciseSetBlueprint {
  const set = asRecord(value, `set #${index + 1} of ${where}`);
  const base = CardioExerciseSetBlueprint.empty();
  return base.with({
    target: parseCardioTarget(set.target, `set #${index + 1} of ${where}`),
    trackDistance: optBoolean(set.trackDistance, base.trackDistance),
    trackDuration: optBoolean(set.trackDuration, base.trackDuration),
    trackIncline: optBoolean(set.trackIncline, base.trackIncline),
    trackResistance: optBoolean(set.trackResistance, base.trackResistance),
    trackWeight: optBoolean(set.trackWeight, base.trackWeight),
    trackSteps: optBoolean(set.trackSteps, base.trackSteps),
  });
}

function parseCardioTarget(value: unknown, where: string): CardioTarget {
  const target = asRecord(value, `the target of ${where}`);
  if (target.type === 'time') {
    return {
      type: 'time',
      value: parseDurationField(target.value, `the time target of ${where}`),
    };
  }
  if (target.type === 'distance') {
    const distance = asRecord(target.value, `the distance target of ${where}`);
    const unit = asString(distance.unit, `the distance unit of ${where}`);
    if (!DistanceUnits.includes(unit as DistanceUnit)) {
      fail(
        `"${unit}" is not a valid distance unit. Use one of: ${DistanceUnits.join(', ')}.`,
      );
    }
    return {
      type: 'distance',
      value: {
        value: new BigNumber(
          asNumber(distance.value, `the distance of ${where}`),
        ),
        unit: unit as DistanceUnit,
      },
    };
  }
  return fail(
    `The cardio target type of ${where} must be "time" or "distance".`,
  );
}
