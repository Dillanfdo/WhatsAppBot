import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

const AdminLayout = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen">
    <AdminSidebar />
    <main className="flex-1 p-6">{children}</main>
  </div>
);

export default AdminLayout;
