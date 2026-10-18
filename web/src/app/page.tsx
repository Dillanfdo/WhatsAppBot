import { Card } from "@/components/ui/card";
import { LandingIntro } from "@/components/home/LandingIntro";
import { LandingLinks } from "@/components/home/LandingLinks";

const Home = () => (
  <div className="flex flex-1 items-center justify-center p-8">
    <Card className="w-full max-w-lg">
      <LandingIntro />
      <LandingLinks />
    </Card>
  </div>
);

export default Home;
