import { StatCard } from "@/components/admin/dashboard/StatCard";
import { bookingTotal, bookingsTodayCount, storeStatusCounts, upcomingWeekCount } from "@/lib/dashboard";

export const DashboardStats = async () => {
  const [stores, today, upcoming, total] = await Promise.all([
    storeStatusCounts(),
    bookingsTodayCount(),
    upcomingWeekCount(),
    bookingTotal(),
  ]);

  if (stores.live + stores.draft === 0) {
    return <p className="text-sm text-muted-foreground">No stores yet. Start with the setup wizard.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Stores" value={`${stores.live} live · ${stores.draft} draft`} />
      <StatCard label="Bookings today" value={String(today)} />
      <StatCard label="Next 7 days" value={String(upcoming)} />
      <StatCard label="All bookings" value={String(total)} />
    </div>
  );
};
