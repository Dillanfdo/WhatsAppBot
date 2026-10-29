import { config } from "dotenv";

const main = async () => {
  config({ path: ".env.local", quiet: true });
  const { bookingTotal, bookingsTodayCount, storesNeedingSetup, recentBookings, storeStatusCounts, upcomingWeekCount } =
    await import("../lib/dashboard");
  const result = await Promise.all([
    storeStatusCounts(),
    bookingsTodayCount(),
    upcomingWeekCount(),
    bookingTotal(),
    storesNeedingSetup(),
    recentBookings(),
  ]);
  console.log(JSON.stringify(result, null, 2));
};

void main();
