import type { LucideIcon } from "lucide-react";
import Link from "next/link";

type AdminNavLinkProps = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const AdminNavLink = ({ href, label, icon: Icon }: AdminNavLinkProps) => (
  <Link
    href={href}
    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent"
  >
    <Icon className="size-4" />
    {label}
  </Link>
);
