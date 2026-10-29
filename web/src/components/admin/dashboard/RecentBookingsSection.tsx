import { recentBookings } from "@/lib/dashboard";

export const RecentBookingsSection = async () => {
  const recent = await recentBookings();
  return (
    <div>
      <h2 className="mb-2 font-medium">Latest bookings</h2>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {recent.map((row) => (
            <li key={row.id}>
              {row.storeName} · {row.serviceName} · {row.status} · {row.startsLabel}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
