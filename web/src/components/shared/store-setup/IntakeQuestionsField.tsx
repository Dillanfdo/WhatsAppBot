import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ServiceDraft } from "@/lib/service-draft";

type IntakeQuestionsFieldProps = {
  value: ServiceDraft["intakeQuestions"];
  onChange: (value: ServiceDraft["intakeQuestions"]) => void;
};

export const IntakeQuestionsField = ({ value, onChange }: IntakeQuestionsFieldProps) => {
  const update = (index: number, patch: Partial<ServiceDraft["intakeQuestions"][number]>) =>
    onChange(value.map((item, position) => (position === index ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-2">
      {value.map((question, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={`Question ${index + 1}`}
            value={question.label}
            placeholder="Any allergies we should know about?"
            onChange={(event) => update(index, { label: event.target.value })}
          />
          <label className="flex shrink-0 items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(event) => update(index, { required: event.target.checked })}
            />
            Required
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { label: "", required: false }])}>
        Add question
      </Button>
    </div>
  );
};
