import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { accent, status } from '@/constants';
import { DeviceRow } from './DeviceRow';

/**
 * Drie assen: `icon` (union), `loading` en `actionDisabled` (booleans). `iconColor` is een
 * vrije kleurwaarde en dus géén as — de rol (groen = verbonden, accent = bezig, rood = fout)
 * wordt door BleStatusBar/HrStatusBar bepaald, niet door de component.
 *
 * `label` en `action` zijn vrije strings: DeviceRow is puur presentationeel en vertaalt zelf
 * niets. De teksten hieronder komen uit `i18n/translations/nl.ts` → `devices`.
 *
 * Let op: bij `loading` vervangt de spinner het icoon, dus `icon` is dan niet zichtbaar —
 * de twee assen zijn niet onafhankelijk in beeld, wel in het propcontract.
 */
const meta = {
  title: 'Componenten/DeviceRow',
  component: DeviceRow,
  argTypes: {
    icon: { control: 'select', options: ['dot', 'heart'] },
    iconColor: { control: 'color' },
    loading: { control: 'boolean' },
    actionDisabled: { control: 'boolean' },
    onPress: { control: false },
  },
  args: {
    icon: 'dot',
    iconColor: status.success,
    label: 'Concept2 PM5',
    action: 'Verbreken',
    onPress: () => {},
    loading: false,
    actionDisabled: false,
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-12742' },
  },
} satisfies Meta<typeof DeviceRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

/** Hartslagmeter-regel: `icon: 'heart'` in plaats van de statusdot. */
export const Hartslagmeter: Story = {
  args: { icon: 'heart', iconColor: status.error, label: 'Polar H10', action: 'Verbreken' },
};

/** Bezig-toestand: spinner op de icoonplek, actie uitgeschakeld. */
export const Verbinden: Story = {
  args: {
    iconColor: accent.default,
    label: 'Roeitrainer',
    action: 'Verbinden…',
    loading: true,
    actionDisabled: true,
  },
};

/** Foutstand na een mislukte verbinding: rode dot, actie wordt "Opnieuw". */
export const Fout: Story = {
  args: { iconColor: status.error, label: 'Roeitrainer', action: 'Opnieuw' },
};

/** Ruststand: nog niets verbonden, dot in merk-accent. */
export const Inactief: Story = {
  args: { iconColor: accent.default, label: 'Roeitrainer', action: 'Verbinden' },
};

/** Alleen de actie is dood; het icoon blijft de statusdot (geen spinner). */
export const Uitgeschakeld: Story = {
  args: { actionDisabled: true },
};

/** Edge case: het label staat op `numberOfLines={1}` en moet vóór de actie afkappen. */
export const LangeApparaatnaam: Story = {
  args: { label: 'Concept2 PM5 — ergometer 3, clubzaal boven' },
};
