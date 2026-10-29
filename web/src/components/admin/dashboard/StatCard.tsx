type StatCardProps = {
  label: string;
  value: string;
};

export const StatCard = ({ label, value }: StatCardProps) => (
  <div className="rounded-lg border p-3">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-lg font-medium">{value}</p>
  </div>
);
