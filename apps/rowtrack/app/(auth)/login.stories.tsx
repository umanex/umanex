import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { TOESTEL } from '../../.storybook/toestel';
import LoginScreen from './login';

/**
 * Het inlogscherm heeft geen props: alles is interne state. De stories tonen daarom de
 * toestanden die de gebruiker doorloopt, niet varianten van een as — er ís geen as.
 *
 * `signIn` raakt de gemockte supabase, dus de knop doet in Storybook niets destructiefs.
 */
const meta = {
  title: 'Componenten/LoginScreen',
  component: LoginScreen,
  parameters: { toestel: TOESTEL.portret },
} satisfies Meta<typeof LoginScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Leeg formulier — de story waarop de parity-as joint. */
export const Playground: Story = {};
