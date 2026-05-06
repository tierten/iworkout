import {
  CardioExerciseBlueprint,
  ProgramBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { RecordedCardioExercise, RecordedWeightedExercise, Session } from '@/models/session-models';
import { showSnackbar } from '@/store/app';
import { savePlan } from '@/store/program';
import { AddEffectFn } from '@/store/store';
import { toAiWorkoutPlan } from '@/services/ai-chat-service';
import { uuid } from '@/utils/uuid';
import { LocalDate } from '@js-joda/core';
import { exportForClaude, importFromClaudeJson } from '@/store/settings';
import { shortFormatWeightUnit } from '@/models/weight';

export function addClaudeJsonEffects(addEffect: AddEffectFn) {
  addEffect(
    importFromClaudeJson,
    async (_, { dispatch, extra: { filePickerService, tolgee } }) => {
      const file = await filePickerService.pickFile();
      if (!file) {
        return;
      }
      try {
        const text = new TextDecoder().decode(file.bytes);
        const parsed: unknown = JSON.parse(text);
        const plan = toAiWorkoutPlan(
          parsed as Parameters<typeof toAiWorkoutPlan>[0],
        );
        const programBlueprint = new ProgramBlueprint(
          plan.name,
          plan.sessions,
          LocalDate.now(),
        );
        dispatch(savePlan({ programId: uuid(), programBlueprint }));
        dispatch(
          showSnackbar({
            text: tolgee.t('Plan imported successfully'),
          }),
        );
      } catch {
        dispatch(
          showSnackbar({
            text: tolgee.t('Could not import: invalid JSON format'),
          }),
        );
      }
    },
  );

  addEffect(
    exportForClaude,
    async (_, { getState, extra: { progressRepository, fileExportService } }) => {
      const state = getState();
      const activePlanPOJO =
        state.program.savedPrograms[state.program.activePlanId];
      const activeProgram = activePlanPOJO
        ? ProgramBlueprint.fromPOJO(activePlanPOJO)
        : undefined;

      const currentPlan = activeProgram
        ? serializePlanForClaude(activeProgram)
        : null;

      const recentSessions = progressRepository
        .getOrderedSessions()
        .take(20)
        .select(serializeSessionForClaude)
        .toArray();

      const exportObj = { currentPlan, recentSessions };
      const bytes = new TextEncoder().encode(
        JSON.stringify(exportObj, null, 2),
      );
      const now = new Date()
        .toISOString()
        .replaceAll(':', '')
        .replaceAll('.', '')
        .replaceAll('-', '')
        .replace('T', '_')
        .replace('Z', '');
      await fileExportService.exportBytes(
        `claude-workout-export.${now}.json`,
        bytes,
        'application/json',
      );
    },
  );
}

function serializePlanForClaude(program: ProgramBlueprint) {
  return {
    name: program.name,
    sessions: program.sessions.map((session) => ({
      name: session.name,
      notes: session.notes,
      exercises: session.exercises.map((ex) => {
        if (ex instanceof WeightedExerciseBlueprint) {
          return {
            name: ex.name,
            sets: ex.sets,
            repsPerSet: ex.repsPerSet,
            weightIncreaseOnSuccess: ex.weightIncreaseOnSuccess.toNumber(),
            restBetweenSets: {
              minRest: ex.restBetweenSets.minRest.toString(),
              maxRest: ex.restBetweenSets.maxRest.toString(),
              failureRest: ex.restBetweenSets.failureRest.toString(),
            },
            supersetWithNext: ex.supersetWithNext,
            notes: ex.notes,
            link: ex.link,
          };
        }
        if (ex instanceof CardioExerciseBlueprint) {
          return {
            name: ex.name,
            notes: ex.notes,
            link: ex.link,
            sets: ex.sets.map((set) => ({
              target:
                set.target.type === 'time'
                  ? { type: 'time', value: set.target.value.toString() }
                  : {
                      type: 'distance',
                      value: {
                        value: set.target.value.value.toNumber(),
                        unit: set.target.value.unit,
                      },
                    },
              trackDuration: set.trackDuration,
              trackDistance: set.trackDistance,
              trackResistance: set.trackResistance,
              trackIncline: set.trackIncline,
              trackWeight: set.trackWeight,
              trackSteps: set.trackSteps,
            })),
          };
        }
        return null;
      }),
    })),
  };
}

function serializeSessionForClaude(session: Session) {
  return {
    date: session.date.toString(),
    sessionName: session.blueprint.name,
    exercises: session.recordedExercises.map((ex) => {
      if (ex instanceof RecordedWeightedExercise) {
        return {
          name: ex.blueprint.name,
          type: 'weighted' as const,
          targetRepsPerSet: ex.blueprint.repsPerSet,
          sets: ex.potentialSets.map((ps) => ({
            weight: ps.weight.value.toNumber(),
            unit: shortFormatWeightUnit(ps.weight.unit),
            targetReps: ex.blueprint.repsPerSet,
            repsCompleted: ps.set?.repsCompleted ?? null,
            completed: ps.set !== undefined,
          })),
        };
      }
      if (ex instanceof RecordedCardioExercise) {
        return {
          name: ex.blueprint.name,
          type: 'cardio' as const,
          sets: ex.sets.map((s) => ({
            duration: s.duration?.toString() ?? null,
            distance: s.distance
              ? { value: s.distance.value.toNumber(), unit: s.distance.unit }
              : null,
            completed: s.completionDateTime !== undefined,
          })),
        };
      }
      return null;
    }),
  };
}
