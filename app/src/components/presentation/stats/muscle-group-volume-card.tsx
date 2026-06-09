import { spacing, useAppTheme } from '@/hooks/useAppTheme';
import { MuscleGroupVolume } from '@/store/stored-sessions';
import { View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import WeightFormat from '@/components/presentation/foundation/weight-format';

export default function MuscleGroupVolumeCard({
  muscleVolumes,
}: {
  muscleVolumes: MuscleGroupVolume[];
}) {
  const { colors } = useAppTheme();

  if (!muscleVolumes.length) return null;

  const maxVolume = muscleVolumes[0].volume;

  return (
    <Card mode="contained">
      <Card.Content style={{ gap: spacing[2] }}>
        {muscleVolumes.map(({ muscle, volume }) => {
          const barWidth = maxVolume.value.isZero()
            ? 0
            : volume.value.div(maxVolume.value).toNumber();
          return (
            <View key={muscle} style={{ gap: spacing[1] }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text variant="labelMedium" style={{ textTransform: 'capitalize' }}>
                  {muscle}
                </Text>
                <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
                  <WeightFormat weight={volume} />
                </Text>
              </View>
              <View
                style={{
                  height: spacing[1],
                  borderRadius: spacing[0.5],
                  backgroundColor: colors.surfaceContainerHighest,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${(barWidth * 100).toFixed(1)}%`,
                    backgroundColor: colors.primary,
                    borderRadius: spacing[0.5],
                  }}
                />
              </View>
            </View>
          );
        })}
      </Card.Content>
    </Card>
  );
}
