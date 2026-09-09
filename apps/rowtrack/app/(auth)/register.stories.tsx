import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { TOESTEL } from '../../.storybook/toestel';
import RegisterScreen from './register';

/** Registratie: e-mail, wachtwoord en bevestiging, met veldvalidatie op blur. */
const meta = {
  title: 'Componenten/RegisterScreen',
  component: RegisterScreen,
  parameters: { toestel: TOESTEL.portret },
} satisfies Meta<typeof RegisterScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Leeg formulier — de story waarop de parity-as joint. */
export const Playground: Story = {};
