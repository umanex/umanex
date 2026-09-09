import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { TOESTEL } from '../../.storybook/toestel';
import ForgotPasswordScreen from './forgot-password';

/** Wachtwoord vergeten: één veld en een terugweg naar inloggen. */
const meta = {
  title: 'Componenten/ForgotPasswordScreen',
  component: ForgotPasswordScreen,
  parameters: { toestel: TOESTEL.portret },
} satisfies Meta<typeof ForgotPasswordScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Leeg formulier — de story waarop de parity-as joint. */
export const Playground: Story = {};
