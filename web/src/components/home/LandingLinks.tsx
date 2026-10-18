import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";

export const LandingLinks = () => (
  <CardContent className="flex gap-3">
    <Link className={buttonVariants()} href="/admin">
      Admin
    </Link>
    <Link className={buttonVariants({ variant: "outline" })} href="/chat">
      Chat test
    </Link>
  </CardContent>
);
