"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

const CATEGORIES = ["코인", "한국주식", "미국주식", "일본주식", "영국주식"];
const TAGS = ["삼성전자", "현대자동차", "엘지전자", "비트코인", "이더리움", "테슬라", "애플"];

export function CategoryFilter() {
  const [activeCategory, setActiveCategory] = useState("코인");

  return (
    <div className="w-full space-y-4 py-4">
      {/* Main Categories */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-sm font-bold px-3 py-1.5 transition-colors relative ${activeCategory === cat ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {cat}
            {activeCategory === cat && (
              <span className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Sub Tags */}
      <div className="flex flex-wrap gap-4 items-center">
        {TAGS.map((tag) => (
          <button
            key={tag}
            className="text-sm text-foreground/80 hover:text-foreground font-medium transition-colors"
          >
            {tag}
          </button>
        ))}
        <span className="text-sm font-bold text-muted-foreground ml-2">
          (랭킹순위 리스트 출력 클릭시 해당 종목 게시판 리스트)
        </span>
      </div>
    </div>
  );
}
