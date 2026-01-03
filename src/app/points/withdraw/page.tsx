"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserPoints, requestWithdrawal, WithdrawRequest } from "@/lib/api/points";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WithdrawalPage() {
  const [points, setPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Form State
  const [amount, setAmount] = useState<number>(0);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  const fetchData = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        router.push('/login');
        return;
    }

    // Parallel fetch
    const pBalance = getUserPoints(user.id);
    const pRequests = supabase
        .from('withdraw_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    const [balance, reqResult] = await Promise.all([pBalance, pRequests]);
    
    setPoints(balance);
    if (reqResult.data) {
        setRequests(reqResult.data as WithdrawRequest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return alert("출금 금액은 0보다 커야 합니다.");
    if (amount > points) return alert("보유 포인트보다 많은 금액을 출금할 수 없습니다.");
    if (!bankName || !accountNumber || !accountHolder) return alert("계좌 정보를 모두 입력해주세요.");

    setIsSubmitting(true);
    try {
        const { data: { user } } = await createClient().auth.getUser();
        if (!user) throw new Error("User not found");

        await requestWithdrawal(user.id, amount, {
            bankName,
            accountNumber,
            accountHolder
        });

        alert("출금 신청이 완료되었습니다.");
        setAmount(0);
        // Refresh data
        fetchData();
    } catch (error: any) {
        console.error(error);
        alert(`출금 신청 실패: ${error.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
      switch (status) {
          case 'PENDING': return <Badge variant="outline" className="border-yellow-500 text-yellow-500">대기중</Badge>;
          case 'APPROVED': 
          case 'COMPLETED': return <Badge className="bg-green-600">완료</Badge>;
          case 'REJECTED': return <Badge variant="destructive">거절됨</Badge>;
          default: return <Badge>{status}</Badge>;
      }
  };

  return (
    <div className="container mx-auto max-w-4xl py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">포인트 출금</h1>
        <p className="text-gray-400">보유한 포인트를 현금으로 출금 신청할 수 있습니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Request Form */}
        <div className="md:col-span-1 space-y-6">
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-lg">보유 포인트</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                        <div className="text-3xl font-bold text-primary">
                            {points.toLocaleString()} P
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>출금 신청</CardTitle>
                    <CardDescription>최소 10,000 P 부터 신청 가능합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>출금 금액</Label>
                            <Input 
                                type="number" 
                                placeholder="0" 
                                value={amount || ''} 
                                onChange={(e) => setAmount(Number(e.target.value))}
                            />
                            <div className="text-xs text-gray-500 flex justify-between">
                                <span>신청 가능: {points.toLocaleString()} P</span>
                                <span className="cursor-pointer text-blue-500 hover:underline" onClick={() => setAmount(points)}>전액 입력</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>은행명</Label>
                            <Input 
                                placeholder="예: 카카오뱅크, 신한은행" 
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>계좌번호</Label>
                            <Input 
                                placeholder="- 없이 입력" 
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>예금주</Label>
                            <Input 
                                placeholder="실명 입력" 
                                value={accountHolder}
                                onChange={(e) => setAccountHolder(e.target.value)}
                            />
                        </div>

                        <div className="pt-2">
                             <div className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-900/10 p-2 rounded mb-4">
                                <AlertCircle className="h-4 w-4" />
                                <span>부정확한 정보 입력 시 입금이 지연될 수 있습니다.</span>
                             </div>
                             <Button type="submit" className="w-full" disabled={isSubmitting || amount < 10000}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : null}
                                {amount < 10000 ? '10,000 P 이상 신청 가능' : '출금 신청하기'}
                             </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>

        {/* Right: History */}
        <div className="md:col-span-2">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle>출금 신청 내역</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin"/></div>
                    ) : requests.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">출금 신청 내역이 없습니다.</div>
                    ) : (
                        <div className="space-y-4">
                             {requests.map((req) => (
                                 <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-card transition-colors">
                                     <div className="space-y-1 mb-2 sm:mb-0">
                                         <div className="flex items-center gap-2">
                                             <span className="font-bold text-lg">{req.amount.toLocaleString()} P</span>
                                             {getStatusBadge(req.status)}
                                         </div>
                                         <div className="text-sm text-gray-500">
                                             {req.bank_name} {req.account_number} ({req.account_holder})
                                         </div>
                                     </div>
                                     <div className="text-right text-sm text-gray-400">
                                         <div>신청일: {new Date(req.created_at).toLocaleDateString()}</div>
                                         {req.processed_at && (
                                             <div>처리일: {new Date(req.processed_at).toLocaleDateString()}</div>
                                         )}
                                     </div>
                                 </div>
                             ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
