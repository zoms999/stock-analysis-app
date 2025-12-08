
"use client";

import dynamic from "next/dynamic";

const TechChart = dynamic(() => import("@/components/chart/TechChart").then(mod => mod.TechChart), {
  ssr: false,
  loading: () => <p>Loading Chart...</p>
});

export default function TestChartPage() {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">Chart Test Page</h1>
      <TechChart />
    </div>
  );
}
