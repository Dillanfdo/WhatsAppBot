import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const EmptyStoreList = () => (
  <Card>
    <CardHeader>
      <CardTitle>No stores yet</CardTitle>
      <CardDescription>
        Create a store to configure booking for a business.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">No businesses are in the database yet.</p>
    </CardContent>
  </Card>
);
