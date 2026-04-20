'use client';

interface ReservationTriggerButtonProps {
  onClick: () => void;
}

export function ReservationTriggerButton({ onClick }: ReservationTriggerButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-input bg-background text-sm font-medium text-secondary hover:bg-muted transition-colors"
    >
      <span aria-hidden="true">🪣</span>
      Spaarpotten
    </button>
  );
}
