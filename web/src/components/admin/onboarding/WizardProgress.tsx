type WizardProgressProps = {
  steps: readonly string[];
  current: number;
};

export const WizardProgress = ({ steps, current }: WizardProgressProps) => (
  <div className="space-y-2">
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-primary transition-all" style={{ width: `${(current / steps.length) * 100}%` }} />
    </div>
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {steps.map((label, index) => (
        <li
          key={label}
          aria-current={index + 1 === current ? "step" : undefined}
          className={index + 1 === current ? "font-semibold" : "text-muted-foreground"}
        >
          {index + 1}. {label}
        </li>
      ))}
    </ol>
  </div>
);
