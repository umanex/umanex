import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HealthConsentScreen } from './HealthConsentScreen';

/**
 * `visible` is de enige as; `onGrant` en `onDecline` zijn callbacks, geen variant. Het scherm
 * zit in een `Modal`, dus het staat in elke story open — op `visible: false` rendert de story leeg.
 *
 * Laden en fout zijn hier géén props maar interne state: het scherm leidt ze af uit de
 * `Promise<boolean>` die de callback teruggeeft. Ze zijn dus alleen zichtbaar ná een tik op
 * een van de twee knoppen — vandaar dat de stories hieronder de callback sturen, niet een vlag.
 *
 * De `SafeAreaProvider`-decorator is geen mock maar dezelfde provider die de app in
 * `app/_layout.tsx` op de root zet: het scherm roept `useSafeAreaInsets()` aan, en die gooit
 * zonder provider. Hoort op termijn in `.storybook/preview.tsx`.
 */
const meta = {
  title: 'Componenten/HealthConsentScreen',
  component: HealthConsentScreen,
  decorators: [
    (Story) => (
      <SafeAreaProvider>
        <Story />
      </SafeAreaProvider>
    ),
  ],
  argTypes: {
    visible: { control: 'boolean' },
    onGrant: { control: false },
    onDecline: { control: false },
  },
  args: {
    visible: true,
    // Expliciet `Promise<boolean>`: zonder die annotatie leidt TS `Promise<true>` af en
    // weigert elke story die `false` teruggeeft.
    onGrant: async (): Promise<boolean> => true,
    onDecline: async (): Promise<boolean> => true,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2036-20755' },
  },
} satisfies Meta<typeof HealthConsentScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle args in meta. */
export const Playground: Story = {};

/**
 * Fout-toestand: de opslag van de keuze mislukt (callback geeft `false`). Het scherm blijft
 * staan en toont de foutregel onder de tekst — doorlaten zou betekenen dat de app verdergaat
 * zonder dat de toestemming ergens vastligt. Zichtbaar ná een tik op een van beide knoppen.
 */
export const OpslaanMislukt: Story = {
  args: {
    onGrant: async () => false,
    onDecline: async () => false,
  },
};

/**
 * Laad-toestand: een callback die nooit resolvet houdt de aangetikte knop op `loading` en
 * zet beide knoppen op disabled. Zichtbaar ná een tik — er is geen prop die dit forceert.
 */
export const BezigMetOpslaan: Story = {
  args: {
    onGrant: () => new Promise<boolean>(() => {}),
    onDecline: () => new Promise<boolean>(() => {}),
  },
};
