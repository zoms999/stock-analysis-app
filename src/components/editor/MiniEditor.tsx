"use client";

import { Button } from "@/components/ui/button";
import { LineChart, Image as ImageIcon } from "lucide-react";

export function MiniEditor() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="bg-secondary/30 px-4 py-2 flex items-center justify-between border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">빠른 차트 분석</span>
        <div className="flex space-x-1">
             <Button variant="ghost" size="icon" className="h-6 w-6" title="차트 첨부">
                <LineChart className="h-4 w-4" />
             </Button>
             <Button variant="ghost" size="icon" className="h-6 w-6" title="이미지 첨부">
                <ImageIcon className="h-4 w-4" />
             </Button>
        </div>
      </div>
      <div className="p-4">
        <textarea 
            className="w-full bg-transparent text-sm min-h-[100px] resize-none focus:outline-none placeholder:text-muted-foreground/50" 
            placeholder="현재 차트에 대한 관점을 공유해주세요..." 
        />
        <div className="flex justify-end mt-2">
            <Button size="sm" variant="premium">
                분석글 등록
            </Button>
        </div>
      </div>
    </div>
  );
}
