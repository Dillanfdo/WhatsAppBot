import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

type FieldRowProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export const FieldRow = ({ label, htmlFor, required, error, hint, children }: FieldRowProps) => (
  <div className="space-y-1">
    <Label htmlFor={htmlFor}>
      {label}
      {required ? <span className="text-destructive"> *</span> : null}
    </Label>
    {children}
    {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    {error ? <p className="text-sm text-destructive">{error}</p> : null}
  </div>
);
