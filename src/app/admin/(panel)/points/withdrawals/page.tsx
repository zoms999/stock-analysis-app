"use client";

import { useEffect, useState } from "react";
import { getWithdrawalRequests, processWithdrawalRequest, WithdrawRequest } from "@/lib/api/points";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
        const data = await getWithdrawalRequests(statusFilter === 'ALL' ? undefined : statusFilter);
        setRequests(data);
    } catch (error) {
        console.error(error);
        alert("Failed to fetch requests");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const handleProcess = async (id: string, action: 'APPROVE' | 'REJECT') => {
      if (!confirm(action === 'APPROVE' ? "출금을 승인(완료처리) 하시겠습니까?" : "출금을 거절하고 포인트를 환불하시겠습니까?")) return;
      
      setProcessingId(id);
      try {
          // Retrieve admin id
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          await processWithdrawalRequest(id, action, user.id);
          alert("처리되었습니다.");
          fetchRequests();
      } catch (e: any) {
          alert(`Error: ${e.message}`);
      } finally {
          setProcessingId(null);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <div>
            <h2 className="text-3xl font-bold tracking-tight">출금 관리</h2>
            <p className="text-muted-foreground">사용자의 포인트 출금 요청을 관리합니다.</p>
         </div>
         <Button onClick={fetchRequests} variant="outline">새로고침</Button>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
         <TabsList>
            <TabsTrigger value="PENDING">대기중 (미처리)</TabsTrigger>
            <TabsTrigger value="COMPLETED">완료됨</TabsTrigger>
            <TabsTrigger value="REJECTED">거절됨</TabsTrigger>
            <TabsTrigger value="ALL">전체 내역</TabsTrigger>
         </TabsList>

         <Card className="mt-4">
             <CardContent className="p-0">
                 {loading ? (
                     <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                 ) : requests.length === 0 ? (
                     <div className="text-center py-10 text-gray-500">조회된 데이터가 없습니다.</div>
                 ) : (
                     <div className="divide-y">
                         {requests.map((req) => (
                             <div key={req.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                 <div className="space-y-1">
                                     <div className="flex items-center gap-2">
                                         <Badge variant="secondary" className="font-mono">
                                            {req.user?.nickname || req.user?.email || 'Unknown User'}
                                         </Badge>
                                         <span className="font-bold text-lg">{req.amount.toLocaleString()} P</span>
                                         {getStatusBadge(req.status)}
                                     </div>
                                     <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                         <span>은행: <span className="text-foreground">{req.bank_name}</span></span>
                                         <span>예금주: <span className="text-foreground">{req.account_holder}</span></span>
                                         <span>계좌번호: <span className="text-foreground font-mono">{req.account_number}</span></span>
                                         <span>신청일: {new Date(req.created_at).toLocaleString()}</span>
                                     </div>
                                 </div>
                                 
                                 {req.status === 'PENDING' && (
                                     <div className="flex items-center gap-2 w-full md:w-auto">
                                         <Button 
                                            size="sm" 
                                            className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none"
                                            disabled={!!processingId}
                                            onClick={() => handleProcess(req.id, 'APPROVE')}
                                         >
                                            {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4 mr-1"/>}
                                            승인 (완료)
                                         </Button>
                                         <Button 
                                            size="sm" 
                                            variant="destructive"
                                            className="flex-1 md:flex-none"
                                            disabled={!!processingId}
                                            onClick={() => handleProcess(req.id, 'REJECT')}
                                         >
                                            {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="h-4 w-4 mr-1"/>}
                                            거절
                                         </Button>
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                 )}
             </CardContent>
         </Card>
      </Tabs>
    </div>
  );
}
