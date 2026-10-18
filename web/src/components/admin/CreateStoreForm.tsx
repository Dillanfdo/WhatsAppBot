import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const CreateStoreForm = () => (
  <Card className="max-w-lg">
    <CardHeader>
      <CardTitle>Create store</CardTitle>
      <CardDescription>
        Placeholder form. Saving is not wired up yet.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Sunrise Salon" disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue="Asia/Kolkata" disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="policy">Policy notes</Label>
          <Textarea id="policy" name="policy" disabled />
        </div>
        <Button type="button" disabled>
          Save
        </Button>
      </form>
    </CardContent>
  </Card>
);
