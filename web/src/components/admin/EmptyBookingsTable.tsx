import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const EmptyBookingsTable = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>When</TableHead>
        <TableHead>Customer</TableHead>
        <TableHead>Service</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell colSpan={4} className="text-muted-foreground">
          TODO: list bookings from the database
          <Badge variant="secondary" className="ml-2">
            empty
          </Badge>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
);
