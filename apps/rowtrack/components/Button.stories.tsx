import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { Button } from './Button';

/**
 * De argTypes met `options` of een boolean-control zijn de variant-assen. Precies die assen
 * staan als `variantGroupProperties` op de Figma component set, en de guard legt beide
 * lijsten naast elkaar — dat is de join-sleutel waarop de geometrie-parity draait.
 *
 * `icon` en `iconPosition` zijn bewust géén as: een icoon is een slot, geen variant. In
 * Figma is dat een boolean- plus instance-swap-property op de instance.
 */
const meta = {
  title: 'Componenten/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'destructive', 'ghost', 'outline'] },
    size: { control: 'select', options: ['md', 'lg'] },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    icon: { control: false },
    iconPosition: { control: false },
    onPress: { control: false },
    style: { control: false },
  },
  args: {
    title: 'Start training',
    variant: 'primary',
    size: 'lg',
    loading: false,
    disabled: false,
    onPress: () => {},
  },
  parameters: {
    figma: { url: 'https://www.figma.com/design/QkRgMc7Quqtbow71DiYa1n/RowTrack%20-%20%20Design%20System?node-id=2020-13242' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** De story waarop de parity-as joint: één story, alle assen als args. */
export const Playground: Story = {};

export const Varianten: Story = {
  render: (args) => (
    <>
      <Button {...args} variant="primary" title="Primary" />
      <Button {...args} variant="destructive" title="Destructive" />
      <Button {...args} variant="outline" title="Outline" />
      <Button {...args} variant="ghost" title="Ghost" />
    </>
  ),
};

export const MetIcoon: Story = {
  args: { icon: 'play', iconPosition: 'leading', title: 'Start' },
};

export const Laden: Story = { args: { loading: true } };

export const Uitgeschakeld: Story = { args: { disabled: true } };

/** Edge case uit de briefing: een label van 40 tekens mag niet afknippen binnen de knop. */
export const LangLabel: Story = {
  args: { title: 'Een heel lang knoplabel van veertig tk' },
};
