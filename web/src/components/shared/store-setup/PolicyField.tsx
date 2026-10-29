import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_LABELS, type DocRow, type DocumentType } from "@/lib/store-setup-types";

type PolicyFieldProps = {
  type: DocumentType;
  saved: DocRow | undefined;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
};

const versionLabel = (saved: DocRow | undefined): string => {
  if (!saved) {
    return "Not saved yet";
  }
  const date = saved.createdAt ? new Date(saved.createdAt) : null;
  return date && !Number.isNaN(date.getTime())
    ? `Version ${saved.version} · saved ${date.toLocaleDateString()}`
    : `Version ${saved.version}`;
};

export const PolicyField = ({ type, saved, value, onChange, onSave }: PolicyFieldProps) => {
  const unchanged = value.trim() === (saved?.content ?? "").trim();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label htmlFor={`policy-${type}`}>{DOCUMENT_LABELS[type]}</Label>
        <span className="text-xs text-muted-foreground">
          {versionLabel(saved)}
          {!unchanged ? " · unsaved changes" : ""}
        </span>
      </div>
      <Textarea id={`policy-${type}`} value={value} onChange={(event) => onChange(event.target.value)} />
      <Button type="button" size="sm" disabled={unchanged || value.trim().length === 0} onClick={onSave}>
        Save {DOCUMENT_LABELS[type]}
      </Button>
    </div>
  );
};
