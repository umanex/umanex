'use client';

import { ChevronDown } from 'lucide-react';
import { Button } from '@umanex/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@umanex/ui/components/ui/dropdown-menu';
import type { ScriptState } from '@/lib/types';

type Props = {
  scripts: ScriptState[];
  onRun: (naam: string) => void;
};

export const ScriptMenu = ({ scripts, onRun }: Props) => {
  if (scripts.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Scripts
          <ChevronDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Draait in een Terminal-tab</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {scripts.map((s) => (
          <DropdownMenuItem
            key={s.naam}
            disabled={s.geblokkeerd !== null}
            onSelect={() => s.geblokkeerd === null && onRun(s.naam)}
            className="flex-col items-start gap-0.5"
          >
            <span className="font-mono text-xs">{s.naam}</span>
            {/* De reden staat als tekst in het item, niet in een tooltip: een
                disabled item vangt geen hover, dus die tooltip zou onbereikbaar zijn. */}
            {s.geblokkeerd ? (
              <span className="whitespace-normal text-xs text-muted-foreground">{s.geblokkeerd}</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
