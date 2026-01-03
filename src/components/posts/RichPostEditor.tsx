"use client";

import { Textarea } from "@/components/ui/textarea";

interface RichPostEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichPostEditor({
  content,
  onChange,
  placeholder = "내용을 입력하세요...",
  minHeight = "400px",
}: RichPostEditorProps) {
  return (
    <div className="space-y-2">
      <Textarea
        placeholder={placeholder}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-blue-500 resize-none"
        style={{ minHeight }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>마크다운 문법을 지원합니다</span>
        <span>{content.length} 자</span>
      </div>
    </div>
  );
}


