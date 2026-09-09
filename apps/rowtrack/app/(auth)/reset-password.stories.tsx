import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { TOESTEL } from '../../.storybook/toestel';
import ResetPasswordScreen from './reset-password';

/**
 * Nieuw wachtwoord instellen na een herstel-link. Het scherm leest die link uit de
 * route-parameters; zonder geldige link toont het zijn eigen foutzin, en dat is een echte
 * toestand — vandaar dat de Playground hem zónder link toont en `MetLink` mét.
 */
const meta = {
  title: 'Componenten/ResetPasswordScreen',
  component: ResetPasswordScreen,
  parameters: { toestel: TOESTEL.portret },
} satisfies Meta<typeof ResetPasswordScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Zonder herstel-link — de story waarop de parity-as joint. */
export const Playground: Story = {};

/** Mét een herstel-link in de route-parameters: het formulier is bruikbaar. */
export const MetLink: Story = {
  parameters: {
    toestel: TOESTEL.portret,
    routeParams: { access_token: 'storybook-token', type: 'recovery' },
  },
};
