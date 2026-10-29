import { TIMEZONE_OPTIONS } from "@/lib/time";

type TimezoneSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

export const TimezoneSelect = ({ id, value, onChange }: TimezoneSelectProps) => (
  <select id={id} className="h-9 w-full rounded-md border px-2" value={value} onChange={(event) => onChange(event.target.value)}>
    {TIMEZONE_OPTIONS.map((zone) => (
      <option key={zone} value={zone}>
        {zone}
      </option>
    ))}
  </select>
);
