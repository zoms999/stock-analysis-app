
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
// import Image from "next/image"; // Image optimization requires configuring domains or using local assets

interface RewardCardProps {
  id: string;
  title: string;
  price: number;
  stock: number;
  imageUrl?: string;
  className?: string;
}

export function RewardCard({ id, title, price, stock, imageUrl, className }: RewardCardProps) {
  return (
    <div className={cn("group overflow-hidden rounded-xl border border-border bg-card hover:border-primary/50 transition-all hover:shadow-lg", className)}>
        <div className="aspect-[4/3] bg-muted relative flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
             {/* Placeholder for Image */}
             <Gift className="h-16 w-16 text-muted-foreground/50" />
        </div>
        <div className="p-5">
            <h3 className="font-bold text-lg mb-1 truncate">{title}</h3>
            <p className="text-xs text-muted-foreground mb-4">
                남은 수량: <span className={stock < 10 ? "text-red-500" : ""}>{stock}개</span>
            </p>
            <div className="flex items-center justify-between">
                <span className="font-bold text-yellow-500 text-lg">
                    {price.toLocaleString()} P
                </span>
                <Button size="sm" variant={stock === 0 ? "secondary" : "default"} disabled={stock === 0}>
                    {stock === 0 ? "품절" : "교환하기"}
                </Button>
            </div>
        </div>
    </div>
  );
}
