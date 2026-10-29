import { FieldRow } from "@/components/admin/onboarding/FieldRow";
import { TimezoneSelect } from "@/components/admin/onboarding/TimezoneSelect";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BasicsInput } from "@/lib/onboarding/steps";
import { templates } from "@/lib/templates";
import { STORE_LANGUAGE_OPTIONS, STORE_TONE_OPTIONS } from "@/lib/validation";

export type BasicsValues = Omit<BasicsInput, "tone"> & { tone: string; templateId: string };

type OnboardingBasicsFieldsProps = {
  values: BasicsValues;
  errors: Partial<Record<keyof BasicsValues, string>>;
  onChange: (patch: Partial<BasicsValues>) => void;
};

export const OnboardingBasicsFields = ({ values, errors, onChange }: OnboardingBasicsFieldsProps) => {
  const toggleLanguage = (language: string, checked: boolean) =>
    onChange({
      languages: checked ? [...values.languages, language] : values.languages.filter((item) => item !== language),
    });

  return (
    <div className="space-y-4">
      <FieldRow
        label="Business type"
        htmlFor="store-type"
        required
        hint="Pre-fills hours, resources, services and starter policies. You can change everything later."
      >
        <select
          id="store-type"
          className="h-9 w-full rounded-md border px-2"
          value={values.templateId}
          onChange={(event) => onChange({ templateId: event.target.value })}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </FieldRow>
      <FieldRow label="Business name" htmlFor="store-name" required error={errors.name}>
        <Input id="store-name" value={values.name} onChange={(event) => onChange({ name: event.target.value })} />
      </FieldRow>
      <FieldRow label="Description" htmlFor="store-description" error={errors.description}>
        <Textarea id="store-description" value={values.description} onChange={(event) => onChange({ description: event.target.value })} />
      </FieldRow>
      <FieldRow label="Address" htmlFor="store-address" required error={errors.address}>
        <Textarea id="store-address" value={values.address} onChange={(event) => onChange({ address: event.target.value })} />
      </FieldRow>
      <FieldRow label="Google Maps link" htmlFor="store-map" error={errors.mapUrl}>
        <Input id="store-map" inputMode="url" value={values.mapUrl} onChange={(event) => onChange({ mapUrl: event.target.value })} />
      </FieldRow>
      <FieldRow label="Timezone" htmlFor="store-timezone" required error={errors.timezone}>
        <TimezoneSelect id="store-timezone" value={values.timezone} onChange={(timezone) => onChange({ timezone })} />
      </FieldRow>
      <FieldRow label="Contact phone" htmlFor="store-phone" required error={errors.contactPhone}>
        <Input
          id="store-phone"
          inputMode="tel"
          placeholder="+919876543210"
          value={values.contactPhone}
          onChange={(event) => onChange({ contactPhone: event.target.value })}
        />
      </FieldRow>
      <FieldRow label="Contact email" htmlFor="store-email" error={errors.contactEmail}>
        <Input id="store-email" type="email" value={values.contactEmail} onChange={(event) => onChange({ contactEmail: event.target.value })} />
      </FieldRow>
      <FieldRow
        label="Owner WhatsApp number"
        htmlFor="store-whatsapp"
        required
        error={errors.ownerWhatsapp}
        hint="Where booking and handoff alerts will go."
      >
        <Input
          id="store-whatsapp"
          inputMode="tel"
          placeholder="+919876543210"
          value={values.ownerWhatsapp}
          onChange={(event) => onChange({ ownerWhatsapp: event.target.value })}
        />
      </FieldRow>
      <FieldRow label="Languages customers use" htmlFor="store-language-English" error={errors.languages}>
        <div className="flex flex-wrap gap-4">
          {STORE_LANGUAGE_OPTIONS.map((language) => (
            <label key={language} className="flex items-center gap-2 text-sm">
              <input
                id={`store-language-${language}`}
                type="checkbox"
                className="size-4 accent-primary"
                checked={values.languages.includes(language)}
                onChange={(event) => toggleLanguage(language, event.target.checked)}
              />
              {language}
            </label>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="Tone" htmlFor="store-tone">
        <select
          id="store-tone"
          className="h-9 w-full rounded-md border px-2"
          value={values.tone}
          onChange={(event) => onChange({ tone: event.target.value })}
        >
          {STORE_TONE_OPTIONS.map((tone) => (
            <option key={tone} value={tone}>
              {tone}
            </option>
          ))}
        </select>
      </FieldRow>
    </div>
  );
};
