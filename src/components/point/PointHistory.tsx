
import { cn } from "@/lib/utils";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface HistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "earn" | "spend";
}

interface PointHistoryProps {
  history: HistoryItem[];
  className?: string;
}

export function PointHistory({ history, className }: PointHistoryProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="p-6 border-b border-border">
        <h3 className="font-bold text-lg">최근 활동 내역</h3>
      </div>
      <div className="divide-y divide-border">
        {history.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full",
                        item.type === 'earn' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                    )}>
                        {item.type === 'earn' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">{item.date}</p>
                    </div>
                </div>
                <div className={cn(
                    "font-bold text-lg",
                    item.type === 'earn' ? "text-green-500" : "text-foreground"
                )}>
                    {item.type === 'earn' ? '+' : ''}{item.amount.toLocaleString()} P
                </div>
            </div>
        ))}
        {history.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
                내역이 없습니다.
            </div>
        )}
      </div>
    </div>
  );
}
