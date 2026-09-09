import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';
import source from './sheet.tsx?raw';

// `side` staat hier WEL in argTypes, anders dan bij Tooltip en DropdownMenu. Daar bepaalt
// hij alleen de plaatsing t.o.v. de trigger; hier verandert hij het uiterlijk écht — een
// paneel van rechts is een hoge smalle kolom, een van boven een brede lage strook. Een as
// die de vorm verandert hoort als variant in Figma te staan, en dat doet hij.
const meta: Meta<typeof SheetContent> = {
  title: 'Componenten/Sheet',
  component: SheetContent,
  parameters: {
    tokens: { source },
    figma: { url: 'https://www.figma.com/design/ko2OuasYxyY2YRD69MYhWX/Component-library?node-id=83-37' },
  },
  argTypes: {
    side: {
      control: 'radio',
      options: ['top', 'right', 'bottom', 'left'],
      description: 'Vanaf welke rand het paneel inschuift.',
    },
  },
  args: { side: 'right' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open paneel</Button>
      </SheetTrigger>
      <SheetContent {...args}>
        <SheetHeader>
          <SheetTitle>Titel van het paneel</SheetTitle>
          <SheetDescription>
            Een korte toelichting bij wat er in dit paneel staat.
          </SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Sluiten</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

/** Alle vier de randen naast elkaar — dezelfde as die in Figma de variant-as is. */
export const Randen: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <Sheet key={side}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              {side}
            </Button>
          </SheetTrigger>
          <SheetContent side={side}>
            <SheetHeader>
              <SheetTitle>Paneel vanaf {side}</SheetTitle>
              <SheetDescription>
                Dezelfde inhoud, een andere rand. De maten verschillen per kant.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  ),
};
