import Link from "next/link";
import {
  bookingTotal,
  bookingsTodayCount,
  incompleteStoreCount,
  recentBookings,
  storeStatusCounts,
  upcomingWeekCount,
} from "@/lib/dashboard";

const DashboardPage = async () => {
  const [stores, today, upcoming, total, incomplete, recent] = await Promise.all([
    storeStatusCounts(),
    bookingsTodayCount(),
    upcomingWeekCount(),
    bookingTotal(),
    incompleteStoreCount(),
    recentBookings(),
  ]);
  const empty = stores.live + stores.draft === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/onboarding">New store</Link>
          <Link href="/admin/bookings">Bookings</Link>
          <Link href="/chat">Test chat</Link>
        </div>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">No stores yet. Start with the setup wizard.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Stores</p><p>{stores.live} live · {stores.draft} draft</p></div>
          <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Today</p><p>{today}</p></div>
          <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Next 7 days</p><p>{upcoming}</p></div>
          <div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">All bookings</p><p>{total}</p></div>
        </div>
      )}
      {incomplete > 0 ? (
        <p className="text-sm">
          {incomplete} store{incomplete === 1 ? "" : "s"} still need setup. <Link href="/admin/stores">Continue setup</Link>
        </p>
      ) : null}
      <div>
        <h2 className="mb-2 font-medium">Latest bookings</h2>
        {recent.length === 0 ? <p className="text-sm text-muted-foreground">No bookings yet.</p> : (
          <ul className="space-y-1 text-sm">
            {recent.map((row) => (
              <li key={row.id}>{row.storeName} · {row.serviceName} · {row.status} · {row.startsAt.toISOString()}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
