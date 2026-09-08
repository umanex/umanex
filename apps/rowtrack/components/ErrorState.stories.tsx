import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { t } from '@/i18n';
import { ErrorState } from './ErrorState';

/**
 * `size` is de enige variant-as. `onRetry` is er bewust géén: een callback is in Figma een
 * boolean-property op de instance (knop aan/uit), geen variant-vertakking van de set — vandaar
 * `control: false` plus de story `ZonderOpnieuw` die de knoploze vorm vastlegt.
 *
 * De args zijn de echte defaults uit `@/i18n`, niet overgetypte copy: zo drijft de story niet
 * weg van wat de component zonder props toont.
 */
const meta = {
  title: 'Componenten/ErrorState',
  component: ErrorState,
  argTypes: {
    size: { control: 'select', options: ['sm', 'lg'] },
    icon: { control: false },
    onRetry: { control: false },
  },
  args: {
    title: t.states.errorTitle,
    subtitle: t.states.errorSubtitle,
    retryLabel: t.common.retry,
    icon: 'cloud-offline-outline',
    size: 'sm',
    onRetry: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2025-14496' },
  },
} satisfies Meta<typeof ErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Volledig scherm — zoals op het workout-detail (`<ErrorState onRetry={load} size="lg" />`). */
export const Groot: Story = { args: { size: 'lg' } };

/** Zonder retry-callback valt de knop weg; de tekstblok blijft gecentreerd. */
export const ZonderOpnieuw: Story = { args: { onRetry: undefined } };

/** Alleen een titel: de subtitel is optioneel en mag ontbreken. */
export const ZonderSubtitel: Story = { args: { subtitle: undefined } };

/** Edge case: lange titel én lang retry-label mogen niet afknippen. */
export const LangeTitel: Story = {
  args: {
    title: 'De ritten van deze periode konden niet geladen worden',
    subtitle: 'We proberen het opnieuw zodra je weer verbinding hebt met het netwerk.',
    retryLabel: 'Probeer opnieuw te laden',
  },
};
