import { GitBranch } from 'lucide-react';
import { ThemeToggle } from '@umanex/ui/components/ui/theme-toggle';
import type { RepoStatus } from '@/lib/types';

type Props = {
  repo: RepoStatus | null;
  gemetenOp: string | null;
};

export const RepoBar = ({ repo, gemetenOp }: Props) => (
  <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">umanex-apps</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" aria-hidden="true" />
          <span className="font-mono">{repo ? repo.branch : '…'}</span>
        </span>
        {/* Geen `git fetch` in de poll — die achterstand is zo vers als je laatste
            fetch, en dat hoort er dan ook bij te staan. Zonder getal is die
            voetnoot betekenisloos, dus dan tonen we hem ook niet. */}
        {repo && (repo.voor > 0 || repo.achter > 0) ? (
          <span>
            {repo.voor} voor · {repo.achter} achter op <span className="font-mono">origin/main</span>{' '}
            <span className="text-xs">(sinds je laatste fetch)</span>
          </span>
        ) : null}
      </p>
    </div>
    <div className="flex items-center gap-3">
      {gemetenOp ? (
        <span className="text-xs text-muted-foreground">
          gemeten {new Date(gemetenOp).toLocaleTimeString('nl-BE')}
        </span>
      ) : null}
      <ThemeToggle />
    </div>
  </header>
);
