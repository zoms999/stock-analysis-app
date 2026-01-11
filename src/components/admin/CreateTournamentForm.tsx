'use client';


import { useState, useCallback, useRef } from 'react';
import { createTournament } from '@/app/admin/actions';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { searchStocks, SearchResult } from "@/lib/api/search";


export default function CreateTournamentForm() {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // Form States
  const [eventType, setEventType] = useState<'DECIMAL' | 'PREDICTION'>('PREDICTION');
  const [prizeType, setPrizeType] = useState<'POINT' | 'VOUCHER'>('POINT');
  
  // Search States
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedStock, setSelectedStock] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (!val.trim()) {
        setSearchResults([]);
        return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
        const res = await searchStocks(val);
        setSearchResults(res || []);
        setIsSearching(false);
    }, 500);
  };

  const selectStock = (item: SearchResult) => {
    setSelectedStock(item);
    setQuery("");
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (eventType === 'PREDICTION' && !selectedStock) {
        alert("종목을 선택해주세요.");
        return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const payload = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      event_type: eventType,
      target_date: "", // Not used directly, compatibility
      prize_pool: formData.get('prize_pool') as string,
      
      // New Fields
      stock_symbol: selectedStock?.symbol,
      start_date: formData.get('start_date') as string,
      end_date: formData.get('end_date') as string,
      prize_type: prizeType,
      ranking_rules: formData.get('ranking_rules') as string,
    };

    const res = await createTournament(payload);
    setLoading(false);
    if (res.error) {
      alert(res.error);
    } else {
      alert('Tournament Created Successfully!');
      setIsOpen(false);
      // Reset states
      setSelectedStock(null);
      setQuery("");
      setSearchResults([]);
      setEventType('PREDICTION');
      (e.target as HTMLFormElement).reset();
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        + 새 토너먼트 만들기
      </Button>
    );
  }

  return (
    <Card className="mb-8 overflow-visible">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0">
          <CardTitle>새 토너먼트 만들기</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            이벤트 정보를 입력하고 토너먼트를 생성합니다.
          </p>
        </div>
        <Button variant="outline" onClick={() => setIsOpen(false)}>
          닫기
        </Button>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">이벤트 타입</label>
              <select
                name="event_type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                <option value="PREDICTION">종목 예측 (Type B)</option>
                <option value="DECIMAL">소수점 로또 (Type A)</option>
              </select>
            </div>
            
            <div className="space-y-1.5 relative">
              <label className="text-sm font-medium">대상 종목 {eventType === 'PREDICTION' && <span className="text-red-500">*</span>}</label>
              {selectedStock ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                      <span className="font-bold">{selectedStock.symbol}</span>
                      <span className="text-xs text-muted-foreground">({selectedStock.exchange})</span>
                      <button type="button" onClick={() => setSelectedStock(null)} className="ml-auto text-xs text-red-500 hover:underline">삭제</button>
                  </div>
              ) : (
                  <div className="relative">
                    <Input 
                        placeholder={eventType === 'PREDICTION' ? "종목 검색 (예: Samsung, AAPL)" : "필요 시 선택 (옵션)"}
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        disabled={eventType === 'DECIMAL'} // Optional disable?
                    />
                    {isSearching && <div className="absolute right-3 top-2.5 text-xs text-muted-foreground">검색중...</div>}
                    
                    {searchResults.length > 0 && query && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[200px] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                            {searchResults.map((item) => (
                                <div 
                                    key={`${item.symbol}-${item.exchange}`}
                                    className="cursor-pointer px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
                                    onClick={() => selectStock(item)}
                                >
                                    <div className="font-semibold">{item.symbol}</div>
                                    <div className="text-xs text-muted-foreground">{item.type} | {item.exchange} | {item.country}</div>
                                </div>
                            ))}
                        </div>
                    )}
                  </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">제목</label>
              <Input name="title" required placeholder="예: 삼성전자 주간 예측전" />
            </div>
            <div className="space-y-1.5">
               <label className="text-sm font-medium">상금 유형</label>
               <select
                name="prize_type"
                value={prizeType}
                onChange={(e) => setPrizeType(e.target.value as any)}
                className={cn(
                  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                <option value="POINT">포인트 (Point)</option>
                <option value="VOUCHER">상품권 (Voucher)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
               <label className="text-sm font-medium">총 상금 규모</label>
               <Input name="prize_pool" required placeholder={prizeType === 'POINT' ? "예: 1,000,000 P" : "예: 신세계 상품권 5만원"} />
            </div>
            
             <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">시작 일시</label>
                    <Input name="start_date" type="datetime-local" required />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">종료 일시</label>
                    <Input name="end_date" type="datetime-local" required />
                </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">설명</label>
            <Textarea
              name="description"
              placeholder="토너먼트 설명을 입력하세요"
              className="min-h-[80px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">랭킹 산정 규칙 (Ranking Rules)</label>
            <Textarea
              name="ranking_rules"
              placeholder="예: 20~25 일까지 평균내서 제일 근접한 순위\n예: 5일치 평균 랭킹 1위"
              className="min-h-[80px]"
            />
          </div>

        </CardContent>

        <CardFooter className="gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            취소
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "생성 중..." : "토너먼트 생성"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
