import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StoreSummary } from "@/lib/validation";

type StoreListProps = {
  stores: StoreSummary[];
};

export const StoreList = ({ stores }: StoreListProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Timezone</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {stores.map((store) => (
        <TableRow key={store.id}>
          <TableCell>
            <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/stores/${store.id}`}>
              {store.name}
            </Link>
          </TableCell>
          <TableCell>{store.type}</TableCell>
          <TableCell>{store.timezone}</TableCell>
          <TableCell>
            <Badge variant={store.isActive ? "default" : "secondary"}>
              {store.isActive ? "Active" : "Inactive"}
            </Badge>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);
