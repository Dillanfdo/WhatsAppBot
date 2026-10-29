import { Suspense } from "react";
import { DashboardHeader } from "@/components/admin/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/admin/dashboard/DashboardStats";
import { RecentBookingsSection } from "@/components/admin/dashboard/RecentBookingsSection";
import { SetupNeededSection } from "@/components/admin/dashboard/SetupNeededSection";

const Loading = ({ what }: { what: string }) => <p className="text-sm text-muted-foreground">Loading {what}…</p>;

const DashboardPage = () => (
  <div className="space-y-6">
    <DashboardHeader />
    <Suspense fallback={<Loading what="stats" />}>
      <DashboardStats />
    </Suspense>
    <Suspense fallback={<Loading what="setup status" />}>
      <SetupNeededSection />
    </Suspense>
    <Suspense fallback={<Loading what="bookings" />}>
      <RecentBookingsSection />
    </Suspense>
  </div>
);

export default DashboardPage;
