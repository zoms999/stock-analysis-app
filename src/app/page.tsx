import { HeroChart } from "@/components/home/HeroChart";
import { PostFeed } from "@/components/home/PostFeed";
import { MiniEditor } from "@/components/editor/MiniEditor";

export default function Home() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left / Top: Chart Area (Span 2 cols on Large screens) */}
      <div className="lg:col-span-2 space-y-6">
        <HeroChart />
        {/* Editor Area */}
        <MiniEditor />
      </div>

      {/* Right: Feed or Side Widgets */}
      <div className="lg:col-span-1">
        <PostFeed />
      </div>
    </div>
  );
}
