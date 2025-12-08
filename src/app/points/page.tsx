
"use client";

import { PointBalance } from "@/components/point/PointBalance";
import { PointHistory } from "@/components/point/PointHistory";
import { RewardCard } from "@/components/point/RewardCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Need to check if Tabs exists or implement basic tabs

// Mock Data
const MY_BALANCE = 12500;
const USER_LEVEL = "GOLD";

const HISTORY_DATA = [
    { id: '1', date: '2023.12.07 14:30', description: '일일 차트 분석글 작성', amount: 500, type: 'earn' as const },
    { id: '2', date: '2023.12.06 09:15', description: '토너먼트 참가비', amount: -1000, type: 'spend' as const },
    { id: '3', date: '2023.12.05 18:20', description: '친구 초대 보상', amount: 500, type: 'earn' as const },
    { id: '4', date: '2023.12.05 10:00', description: '출석체크', amount: 50, type: 'earn' as const },
];

const REWARDS_DATA = [
    { id: 'r1', title: '스타벅스 아메리카노', price: 4500, stock: 99 },
    { id: 'r2', title: '5 USDT 쿠폰', price: 7000, stock: 50 },
    { id: 'r3', title: '배달의민족 1만원권', price: 12000, stock: 12 },
    { id: 'r4', title: '신세계상품권 5만원', price: 55000, stock: 0 },
];

export default function PointsPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <h1 className="text-3xl font-bold mb-8">내 포인트</h1>
            
            {/* Top Section: Balance */}
            <section className="mb-10">
                <PointBalance balance={MY_BALANCE} level={USER_LEVEL} />
            </section>

            {/* Main Content: Tabs */}
            {/* Since we don't have shadcn Tabs yet, I'll use a simple layout or I should create Tabs component */}
            {/* I will implement a simple Tab-like structure here using state if needed, but lets assume we want to split sections for now */}
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* Left: Rewards (2/3) */}
                 <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold">💎 포인트샵</h2>
                        <span className="text-sm text-muted-foreground">열심히 모은 포인트로 교환하세요!</span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {REWARDS_DATA.map(reward => (
                            <RewardCard key={reward.id} {...reward} />
                        ))}
                    </div>
                 </div>

                 {/* Right: History (1/3) */}
                 <div>
                    <PointHistory history={HISTORY_DATA} />
                 </div>
            </div>
        </div>
    </div>
  );
}
