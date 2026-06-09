import PotentialSetCounter from '@/components/presentation/workout/weighted/potential-set-counter';
import { font, spacing, useAppTheme } from '@/hooks/useAppTheme';
import { RecordedWeightedExercise } from '@/models/session-models';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import ExerciseSection from '@/components/presentation/workout/exercise-section';
import { OffsetDateTime } from '@js-joda/core';
import { bestOneRepMax, calculateOneRepMax } from '@/utils/one-rep-max';
import { useAppSelector } from '@/store';
import { useDispatch } from 'react-redux';
import { showSnackbar } from '@/store/app';
import Icon from '@/components/presentation/foundation/gesture-wrappers/icon';

interface WeightedExerciseProps {
  recordedExercise: RecordedWeightedExercise;
  previousRecordedExercises: RecordedWeightedExercise[];
  toStartNext: boolean;
  isReadonly: boolean;
  showPreviousButton: boolean;

  timeProvider: () => OffsetDateTime;
  updateExercise: (ex: RecordedWeightedExercise) => void;
  resetSetTimer: () => void;
  onEditExercise: () => void;
  onRemoveExercise: () => void;
}

export default function WeightedExercise(props: WeightedExerciseProps) {
  const { updateExercise, timeProvider, resetSetTimer } = props;
  const { recordedExercise } = props;
  const { colors } = useAppTheme();
  const dispatch = useDispatch();
  const formula = useAppSelector((s) => s.settings.oneRepMaxFormula);

  const setToStartNext = recordedExercise.potentialSets.findIndex(
    (x) => !x.set,
  );

  // Live 1RM from the best completed set this session
  const liveOneRepMax = bestOneRepMax(recordedExercise.potentialSets, formula);

  // Progressive overload suggestion
  const prevEx = props.previousRecordedExercises.at(0);
  const showOverloadSuggestion =
    !props.isReadonly && !!prevEx?.isSuccessForProgressiveOverload;
  const suggestedWeight =
    showOverloadSuggestion && prevEx
      ? prevEx.potentialSets[0]?.weight.plus(
          recordedExercise.blueprint.weightIncreaseOnSuccess,
        )
      : undefined;

  // PR detection — fires once per new PR value
  const lastPrRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (props.isReadonly || !liveOneRepMax) return;

    const historicalSets = props.previousRecordedExercises.flatMap(
      (ex) => ex.potentialSets,
    );
    const historicalBest =
      historicalSets.length > 0
        ? historicalSets
            .filter((ps) => ps.set && ps.set.repsCompleted > 0)
            .map((ps) =>
              calculateOneRepMax(ps.weight, ps.set!.repsCompleted, formula),
            )
            .reduce(
              (best, w) => (w.isGreaterThan(best) ? w : best),
              historicalSets[0]?.weight ?? liveOneRepMax,
            )
        : undefined;

    if (historicalBest && liveOneRepMax.isGreaterThan(historicalBest)) {
      const key = liveOneRepMax.value.toFixed(2);
      if (lastPrRef.current !== key) {
        lastPrRef.current = key;
        dispatch(
          showSnackbar({
            text: `🏆 New PR on ${recordedExercise.blueprint.name}!`,
          }),
        );
      }
    }
  }, [recordedExercise.potentialSets]);

  return (
    <ExerciseSection
      recordedExercise={props.recordedExercise}
      previousRecordedExercises={props.previousRecordedExercises}
      toStartNext={props.toStartNext}
      isReadonly={props.isReadonly}
      showPreviousButton={props.showPreviousButton}
      updateExercise={props.updateExercise}
      onEditExercise={props.onEditExercise}
      onRemoveExercise={props.onRemoveExercise}
    >
      {showOverloadSuggestion && suggestedWeight && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing[1],
            paddingBottom: spacing[1],
          }}
        >
          <Icon source={'arrowUpward'} size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, ...font['text-sm'] }}>
            Try {suggestedWeight.shortLocaleFormat(2)} today (last session
            complete)
          </Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' }}>
        {recordedExercise.potentialSets.map((set, index) => (
          <PotentialSetCounter
            isReadonly={props.isReadonly}
            key={index}
            maxReps={recordedExercise.blueprint.repsPerSet}
            onTap={() => {
              const previousSet = recordedExercise.potentialSets[index].set;
              const newExercise = recordedExercise.withCycledRepCount(
                index,
                timeProvider(),
              );
              const newSet = newExercise.potentialSets[index].set;
              updateExercise(newExercise);
              // We only want to reset the timer when switching between unfilled and filled
              // Otherwise, keep the same time
              if (!previousSet || !newSet) {
                resetSetTimer();
              }
            }}
            previousRepCount={
              props.previousRecordedExercises.at(0)?.potentialSets[index]?.set
                ?.repsCompleted
            }
            previousWeight={
              props.previousRecordedExercises.at(0)?.potentialSets[index]
                ?.weight
            }
            onUpdateReps={(reps) => {
              updateExercise(
                recordedExercise.withRepCount(index, reps, timeProvider()),
              );
              resetSetTimer();
            }}
            onUpdateWeight={(w, applyTo) =>
              updateExercise(recordedExercise.withWeight(index, w, applyTo))
            }
            set={set}
            showWeight={true}
            toStartNext={
              props.toStartNext && setToStartNext === index && !props.isReadonly
            }
            weightIncrement={recordedExercise.blueprint.weightIncreaseOnSuccess}
          />
        ))}
      </View>
      {liveOneRepMax && (
        <Text
          style={{
            color: colors.onSurfaceVariant,
            ...font['text-sm'],
            marginTop: spacing[1],
          }}
        >
          Est. 1RM: {liveOneRepMax.shortLocaleFormat(2)}
        </Text>
      )}
    </ExerciseSection>
  );
}
