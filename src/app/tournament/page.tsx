
"use client";

import { EventCard } from "@/components/tournament/EventCard";
import { Leaderboard } from "@/components/tournament/Leaderboard";
import { Button } from "@/components/ui/button";
import { Trophy, Flame, ChevronRight } from "lucide-react";

// Mock Data
const LIVE_EVENTS = [
    {
        id: 1,
        title: "제 1회 비트코인 단기 투자 대회",
        prizePool: "₩10,000,000",
        participants: 1243,
        timeLeft: "04:12:30",
        status: "live" as const,
    }
];

const UPCOMING_EVENTS = [
    {
        id: 2,
        title: "이더리움 주간 챌린지",
        prizePool: "5 ETH",
        participants: 450,
        timeLeft: "3일 후 시작",
        status: "upcoming" as const,
    },
    {
        id: 3,
        title: "솔라나 스피드 트레이딩",
        prizePool: "1,000 SOL",
        participants: 120,
        timeLeft: "5일 후 시작",
        status: "upcoming" as const,
    }
];

const TOP_RANKERS = [
    { id: "u1", rank: 1, name: "CryptoKing", profitRate: 245.3, winRate: 82 },
    { id: "u2", rank: 2, name: "MoonWalker", profitRate: 189.5, winRate: 75 },
    { id: "u3", rank: 3, name: "SatoshiGhost", profitRate: 154.2, winRate: 68 },
    { id: "u4", rank: 4, name: "ShortMaster", profitRate: 98.4, winRate: 60 },
    { id: "u5", rank: 5, name: "HodlGang", profitRate: 87.1, winRate: 55 },
];

export default function TournamentPage() {
  return (
    <div className="min-h-screen bg-background pb-20">
        {/* Banner Section */}
        <div className="relative border-b border-border bg-gradient-to-b from-primary/5 to-background py-16">
            <div className="container mx-auto px-4 text-center">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary mb-6">
                    <Flame className="mr-2 h-4 w-4" />
                    현재 총 상금 규모 ₩50,000,000+
                </div>
                <h1 className="text-4xl font-black tracking-tight md:text-6xl mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                    투자 토너먼트
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                    실력있는 트레이더들과 경쟁하고 상금을 획득하세요.<br className="hidden md:block"/>
                    AI 기반의 공정한 검증 시스템이 여러분의 실력을 증명합니다.
                </p>
                <div className="flex justify-center gap-4">
                    <Button size="lg" variant="premium" className="h-12 px-8 text-base shadow-xl shadow-primary/20">
                        대회 참가하기
                    </Button>
                    <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                        규정 및 안내
                    </Button>
                </div>
            </div>
            
            {/* Background Decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
        </div>

        <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Events (2/3 width) */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Live Section */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold flex items-center">
                                <span className="mr-2 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                진행 중인 대회
                            </h2>
                            <Button variant="link" className="text-muted-foreground hover:text-primary">
                                전체 보기 <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="grid gap-6">
                            {LIVE_EVENTS.map(event => (
                                <EventCard key={event.id} {...event} />
                            ))}
                        </div>
                    </section>

                    {/* Upcoming Section */}
                    <section>
                         <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold"> 예정된 대회</h2>
                        </div>
                         <div className="grid md:grid-cols-2 gap-6">
                            {UPCOMING_EVENTS.map(event => (
                                <EventCard key={event.id} {...event} />
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right Column: Sidebar (1/3 width) */}
                <div className="space-y-8">
                    <Leaderboard data={TOP_RANKERS} />
                    
                    {/* Promotion Box */}
                    <div className="rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 p-6 border border-indigo-500/30 text-center">
                        <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="font-bold text-lg text-white mb-2">시즌 랭킹 도전!</h3>
                        <p className="text-sm text-indigo-200 mb-6">
                            월간 랭킹 1위에게는<br/>
                            특별한 뱃지와 추가 포인트가 지급됩니다.
                        </p>
                        <Button variant="secondary" className="w-full">
                            내 랭킹 확인하기
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
