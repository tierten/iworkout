import FullHeightScrollView from '@/components/layout/full-height-scroll-view';
import { SurfaceText } from '@/components/presentation/foundation/surface-text';
import { spacing } from '@/hooks/useAppTheme';
import { exportForClaude, importFromClaudeJson } from '@/store/settings';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Card } from 'react-native-paper';
import Button from '@/components/presentation/foundation/gesture-wrappers/button';
import { useDispatch } from 'react-redux';

export default function ClaudeJsonPage() {
  const dispatch = useDispatch();

  return (
    <FullHeightScrollView>
      <Stack.Screen options={{ title: 'Claude JSON' }} />

      <Card
        mode="contained"
        style={{ marginHorizontal: spacing[6], marginBottom: spacing[4] }}
      >
        <Card.Title title="Import Plan from Claude" />
        <Card.Content>
          <SurfaceText style={{ marginBottom: spacing[4] }}>
            Ask Claude to generate a workout plan as JSON and save it as a file.
            Tap the button below to pick that file and automatically create a
            new program in your library.
          </SurfaceText>
          <View style={{ alignItems: 'flex-end' }}>
            <Button
              mode="contained"
              onPress={() => dispatch(importFromClaudeJson())}
            >
              Import Plan
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={{ marginHorizontal: spacing[6], marginBottom: spacing[4] }}
      >
        <Card.Title title="Export for Claude" />
        <Card.Content>
          <SurfaceText style={{ marginBottom: spacing[4] }}>
            Export your current active program and recent workout history as
            JSON. Send it to Claude and ask it to update or optimise your plan,
            then import the result above.
          </SurfaceText>
          <View style={{ alignItems: 'flex-end' }}>
            <Button
              mode="contained"
              onPress={() => dispatch(exportForClaude())}
            >
              Export for Claude
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Card
        mode="contained"
        style={{ marginHorizontal: spacing[6], marginBottom: spacing[4] }}
      >
        <Card.Title title="Expected JSON format" />
        <Card.Content>
          <SurfaceText>
            Claude should return a JSON object with this shape:
          </SurfaceText>
          <SurfaceText
            style={{ fontFamily: 'monospace', fontSize: 11, marginTop: spacing[2] }}
          >
            {JSON.stringify(
              {
                name: 'My Plan',
                sessions: [
                  {
                    name: 'Day 1',
                    notes: '',
                    exercises: [
                      {
                        name: 'Bench Press',
                        sets: 4,
                        repsPerSet: 8,
                        weightIncreaseOnSuccess: 2.5,
                        restBetweenSets: {
                          minRest: 'PT90S',
                          maxRest: 'PT180S',
                          failureRest: 'PT240S',
                        },
                        supersetWithNext: false,
                        notes: '',
                        link: '',
                      },
                    ],
                  },
                ],
              },
              null,
              2,
            )}
          </SurfaceText>
        </Card.Content>
      </Card>
    </FullHeightScrollView>
  );
}
