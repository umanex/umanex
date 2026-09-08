import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { t } from '@/i18n';
import { MotivationalToast } from './MotivationalToast';

/**
 * Geen variant-assen: `message` is vrije tekst en `onDismiss` een callback. De component is
 * een overlay — `message` is tegelijk de inhoud én de zichtbaarheidsschakelaar (`visible =
 * !!message`), dus de default-args dragen een echt bericht; met `null` rendert de Modal niets.
 *
 * Titel en knoplabel komen uit `@/i18n` en zijn geen props: die staan vast in de component.
 * De viering dismisst bewust niet vanzelf — de knop is de enige uitgang.
 */
const meta = {
  title: 'Componenten/MotivationalToast',
  component: MotivationalToast,
  argTypes: {
    onDismiss: { control: false },
  },
  args: {
    message: t.workout.celebration.distance('2.000', 'm'),
    onDismiss: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2013-8185' },
  },
} satisfies Meta<typeof MotivationalToast>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** `null` sluit de Modal: de story rendert bewust niets, dat is de rust-toestand. */
export const Verborgen: Story = { args: { message: null } };

/** Split-doel gehaald — het bericht is langer en breekt over meerdere regels. */
export const SplitDoel: Story = {
  args: { message: t.workout.celebration.split('1:52.4') },
};

/** Duur-doel: de kortste variant van het bericht, één regel. */
export const DuurDoel: Story = {
  args: { message: t.workout.celebration.duration(30) },
};

/** Edge case: een bericht dat de kaart tot zijn maximale breedte vult en doorloopt. */
export const LangBericht: Story = {
  args: {
    message:
      'Je hebt je doel van 280 watt gehaald over 5.000 m in 24:31, bij 26 spm en een gemiddelde hartslag van 148 bpm. Geweldig gedaan! 💪',
  },
};
