
import { cn } from "@/lib/utils";
import { Coins, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/common/ShareModal";

interface PointBalanceProps {
  balance: number;
  level: string;
  className?: string;
}

export function PointBalance({ balance, level, className }: PointBalanceProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-950/30 to-background p-8", className)}>
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-yellow-500/10 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
                <div className="inline-flex items-center rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-500 mb-2 border border-yellow-500/20">
                    <Zap className="mr-1 h-3 w-3" />
                    {level} 멤버십
                </div>
                <h2 className="text-sm text-muted-foreground font-medium">현금처럼 사용 가능한 내 포인트</h2>
                <div className="mt-1 flex items-baseline justify-center md:justify-start">
                    <Coins className="mr-3 h-8 w-8 text-yellow-500" />
                    <span className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">
                        {balance.toLocaleString()}
                    </span>
                    <span className="ml-2 text-xl font-bold text-muted-foreground">P</span>
                </div>
            </div>

            <div className="flex gap-3">
                <Button size="lg" className="bg-yellow-500 text-black hover:bg-yellow-400 font-bold px-8">
                    충전하기
                </Button>
                <ShareModal>
                    <Button size="lg" variant="outline" className="border-yellow-500/30 hover:bg-yellow-500/10">
                        친구초대 (+500P)
                    </Button>
                </ShareModal>
            </div>
        </div>
    </div>
  );
}
