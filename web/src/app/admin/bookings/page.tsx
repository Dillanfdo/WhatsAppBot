import { BookingsHeader } from "@/components/admin/BookingsHeader";
import { EmptyBookingsTable } from "@/components/admin/EmptyBookingsTable";

const BookingsPage = () => (
  <div className="space-y-4">
    <BookingsHeader />
    <EmptyBookingsTable />
  </div>
);

export default BookingsPage;
