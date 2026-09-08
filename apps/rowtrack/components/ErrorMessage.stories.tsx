import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { ErrorMessage } from './ErrorMessage';

/**
 * Geen variant-assen: `message` is de enige prop en die is vrije tekst, geen union.
 * De component heeft dus één vorm in Figma, zonder variant-properties.
 *
 * De lege toestand is hier géén aparte grafische staat maar een vroege `return null` —
 * de story `Leeg` legt dat vast zodat een lege render niet als kapotte story leest.
 */
const meta = {
  title: 'Componenten/ErrorMessage',
  component: ErrorMessage,
  argTypes: {},
  args: {
    message: 'Verbinding met de ergometer verbroken tijdens de rit.',
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-12320' },
  },
} satisfies Meta<typeof ErrorMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** `null` (en de lege string) rendert bewust niets — de banner verdwijnt volledig. */
export const Leeg: Story = { args: { message: null } };

/** Edge case: de tekst breekt af binnen de banner, het icoon blijft op de eerste regel. */
export const LangBericht: Story = {
  args: {
    message:
      'Opslaan mislukt: de rit van 5.000 m in 24:31 staat nog lokaal en wordt opnieuw verstuurd zodra je verbinding terug is.',
  },
};
