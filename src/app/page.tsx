import { HeroChart } from "@/components/home/HeroChart";
import { ChartBoardList } from "@/components/home/ChartBoardList";


export default function Home() {
  return (
    <div className="flex flex-col gap-12 pb-20">
      {/* Hero Section */}
      <HeroChart />

      {/* Chart Board List */}
      <ChartBoardList />
    </div>
  );
}
