import { HeroChart } from "@/components/home/HeroChart";
import { PostFeed } from "@/components/home/PostFeed";


export default function Home() {
  return (
    <div className="flex flex-col gap-12 pb-20">
      {/* Hero Section */}
      <HeroChart />

      {/* Main Feed Section */}
      <PostFeed />
    </div>
  );
}
