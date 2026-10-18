import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StoreResource } from "@/lib/validation";

const RESOURCE_TYPE_LABELS: Record<StoreResource["type"], string> = {
  staff: "Staff",
  table: "Table",
  room: "Room",
  console: "Console",
  chair: "Chair",
};

type StoreResourcesTableProps = {
  resources: StoreResource[];
};

export const StoreResourcesTable = ({ resources }: StoreResourcesTableProps) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Capacity</TableHead>
        <TableHead>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {resources.length === 0 ? (
        <TableRow>
          <TableCell colSpan={4} className="text-muted-foreground">
            No resources yet.
          </TableCell>
        </TableRow>
      ) : (
        resources.map((resource) => (
          <TableRow key={resource.id}>
            <TableCell>{resource.name}</TableCell>
            <TableCell>{RESOURCE_TYPE_LABELS[resource.type]}</TableCell>
            <TableCell>{resource.capacity}</TableCell>
            <TableCell>
              <Badge variant={resource.isActive ? "default" : "secondary"}>
                {resource.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
          </TableRow>
        ))
      )}
    </TableBody>
  </Table>
);
