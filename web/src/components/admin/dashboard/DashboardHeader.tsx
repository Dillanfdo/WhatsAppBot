import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const DashboardHeader = () => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h1 className="text-xl font-semibold">Dashboard</h1>
    <div className="flex gap-2">
      <Link className={buttonVariants()} href="/admin/onboarding">
        New store
      </Link>
      <Link className={buttonVariants({ variant: "outline" })} href="/admin/bookings">
        Bookings
      </Link>
      <Link className={buttonVariants({ variant: "outline" })} href="/chat">
        Test chat
      </Link>
    </div>
  </div>
);
