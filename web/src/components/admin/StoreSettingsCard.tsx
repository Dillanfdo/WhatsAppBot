import { DateTime } from "luxon";
import { StoreHoursForm } from "@/components/admin/StoreHoursForm";
import { ClosureEditor, PolicyEditor, ReadinessPanel, ResourceEditor, ServiceEditor } from "@/components/admin/StoreCatalog";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StoreDetails, UpdateStoreHoursInput } from "@/lib/validation";

type StoreSettingsCardProps = {
  store: StoreDetails;
  hours: UpdateStoreHoursInput;
};

const formatTimestamp = (date: Date, timezone: string): string => {
  const formatted = DateTime.fromJSDate(date).setZone(timezone).toFormat("dd LLL yyyy, h:mm a");
  if (formatted === "Invalid DateTime") {
    return "—";
  }
  return formatted;
};

export const StoreSettingsCard = ({ store, hours }: StoreSettingsCardProps) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{store.name}</CardTitle>
        <Badge variant={store.isActive ? "default" : "secondary"}>
          {store.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>
      <CardDescription>{store.type}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      <ReadinessPanel storeId={store.id} active={store.isActive} />
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="hours">Hours & closures</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <StoreSettingsForm store={store} />
        </TabsContent>
        <TabsContent value="hours" className="space-y-6">
          <StoreHoursForm storeId={store.id} hours={hours} />
          <ClosureEditor storeId={store.id} />
        </TabsContent>
        <TabsContent value="resources">
          <ResourceEditor storeId={store.id} />
        </TabsContent>
        <TabsContent value="services">
          <ServiceEditor storeId={store.id} />
        </TabsContent>
        <TabsContent value="policies">
          <PolicyEditor storeId={store.id} storeName={store.name} />
        </TabsContent>
      </Tabs>
      <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Created</dt>
        <dd>{formatTimestamp(store.createdAt, store.timezone)}</dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd>{formatTimestamp(store.updatedAt, store.timezone)}</dd>
      </dl>
    </CardContent>
  </Card>
);
