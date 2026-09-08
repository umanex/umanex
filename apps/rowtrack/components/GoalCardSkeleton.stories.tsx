import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { StyleSheet, View } from 'react-native';
import { GoalCardSkeleton } from './GoalCardSkeleton';

/**
 * Geen props, dus geen variant-assen en geen args: dit is één vaste vorm — de plaatshouder
 * van GoalProgressCard zolang `usePeriodGoal` laadt. Daarom staat hier alleen Playground:
 * er is geen state, geen edge case en geen optionele prop om apart te tonen.
 *
 * De decorator rekt de story tot de volle breedte. Zonder dat vallen de balken (`45%`, `60%`,
 * `70%`) terug op nul, want de preview-wrapper is `alignItems: 'flex-start'` en de kaart heeft
 * geen eigen breedte — in de app is hij full-bleed.
 */
const styles = StyleSheet.create({
  vullend: { alignSelf: 'stretch' },
});

const meta = {
  title: 'Componenten/GoalCardSkeleton',
  component: GoalCardSkeleton,
  argTypes: {},
  decorators: [
    (Story) => (
      <View style={styles.vullend}>
        <Story />
      </View>
    ),
  ],
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20%E2%80%94%20Design%20System?node-id=2004-4077' },
  },
} satisfies Meta<typeof GoalCardSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};
