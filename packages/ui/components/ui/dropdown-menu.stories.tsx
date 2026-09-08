import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu';
import source from './dropdown-menu.tsx?raw';

// `side` staat bewust niet in argTypes: net als bij Tooltip bepaalt hij de plaatsing
// t.o.v. de trigger, niet het uiterlijk van het paneel. Een as die niets aan de vorm
// verandert, hoort niet als variant in Figma te staan.
const meta: Meta<typeof DropdownMenuContent> = {
  title: 'Componenten/DropdownMenu',
  component: DropdownMenuContent,
  parameters: {
    tokens: { source },
    figma: { url: 'https://www.figma.com/design/ko2OuasYxyY2YRD69MYhWX/Component-library?node-id=79-7' },
  },
  decorators: [
    (Story) => (
      <div className="flex h-64 items-start justify-center pt-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Scripts</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem>type-check</DropdownMenuItem>
        <DropdownMenuItem>lint</DropdownMenuItem>
        <DropdownMenuItem>build</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// Geforceerd open, zodat de docs-pagina het paneel toont zonder interactie.
export const Open: Story = {
  render: () => (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Altijd zichtbaar</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Acties</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          Openen
          <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>Dupliceren</DropdownMenuItem>
        <DropdownMenuItem disabled>Verwijderen</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

// Toont de inset-uitlijning: een CheckboxItem reserveert links ruimte voor het vinkje,
// en `inset` op een gewoon item laat het op diezelfde tekstlijn aansluiten.
export const MetSelectie: Story = {
  render: () => (
    <DropdownMenu open>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Kolommen</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel inset>Zichtbaar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>Status</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked>Poort</DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Git</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
