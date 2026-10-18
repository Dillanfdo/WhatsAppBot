import Link from "next/link";
import { CalendarDays, Store } from "lucide-react";
import { AdminNavLink } from "@/components/admin/AdminNavLink";

export const AdminSidebar = () => (
  <aside className="flex w-56 flex-col gap-4 border-r bg-sidebar p-4 text-sidebar-foreground">
    <Link href="/" className="text-sm font-semibold">
      WhatsAppBot
    </Link>
    <nav className="flex flex-col gap-1 text-sm">
      <AdminNavLink href="/admin" label="Stores" icon={Store} />
      <AdminNavLink href="/admin/bookings" label="Bookings" icon={CalendarDays} />
    </nav>
  </aside>
);
