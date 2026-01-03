'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getPartnerStats, requestSettlement, PartnerStats } from '@/lib/api/partner-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function RequestSettlementPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [stats, setStats] = useState<PartnerStats | null>(null)
  const [requestedAmount, setRequestedAmount] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const MIN_SETTLEMENT = 10000

  useEffect(() => {
    loadPartnerStats()
  }, [])

  const loadPartnerStats = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const data = await getPartnerStats(user.id)
      setStats(data)
    } catch (error) {
      console.error('Failed to load partner stats:', error)
      alert('파트너 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (!stats) return

    const amount = parseInt(requestedAmount)

    // Validation
    if (isNaN(amount) || amount <= 0) {
      setError('올바른 금액을 입력해주세요.')
      return
    }

    if (amount < MIN_SETTLEMENT) {
      setError(`최소 정산 금액은 ${MIN_SETTLEMENT.toLocaleString()}원입니다.`)
      return
    }

    if (amount > stats.pending_earnings) {
      setError('정산 가능 금액을 초과했습니다.')
      return
    }

    if (!bankAccount.trim()) {
      setError('계좌번호를 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const result = await requestSettlement(user.id, amount, bankAccount)
      
      if (result.success) {
        setSuccess(true)
        setRequestedAmount('')
        setBankAccount('')
        // Reload stats to update pending amount
        await loadPartnerStats()
      } else {
        setError(result.message)
      }
    } catch (error) {
      console.error('Failed to request settlement:', error)
      setError('정산 요청 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const setMaxAmount = () => {
    if (stats) {
      setRequestedAmount(stats.pending_earnings.toString())
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">파트너 정보를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">정산 요청</h1>
        <p className="text-muted-foreground">
          정산 가능한 금액을 출금 요청하세요.
        </p>
      </div>

      {/* Success Alert */}
      {success && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">정산 요청 완료</AlertTitle>
          <AlertDescription className="text-green-600">
            정산 요청이 성공적으로 접수되었습니다. 관리자 승인 후 처리됩니다.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Available Balance Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            정산 가능 금액
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-primary mb-2">
            {stats.pending_earnings.toLocaleString()}원
          </div>
          <p className="text-sm text-muted-foreground">
            최소 정산 금액: {MIN_SETTLEMENT.toLocaleString()}원
          </p>
        </CardContent>
      </Card>

      {/* Request Form */}
      <Card>
        <CardHeader>
          <CardTitle>정산 요청 정보</CardTitle>
          <CardDescription>
            정산받을 금액과 계좌 정보를 입력해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">요청 금액 (원)</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="10000"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  min={MIN_SETTLEMENT}
                  max={stats.pending_earnings}
                  className="flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={setMaxAmount}
                  disabled={stats.pending_earnings < MIN_SETTLEMENT}
                >
                  전액
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {MIN_SETTLEMENT.toLocaleString()}원 ~ {stats.pending_earnings.toLocaleString()}원
              </p>
            </div>

            {/* Bank Account Input */}
            <div className="space-y-2">
              <Label htmlFor="bankAccount">계좌번호</Label>
              <Input
                id="bankAccount"
                type="text"
                placeholder="은행명 계좌번호 (예: 국민은행 123-456-789012)"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                정산금을 받을 계좌번호를 입력해주세요.
              </p>
            </div>

            {/* Info Box */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <h4 className="font-medium text-sm">안내사항</h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>정산 요청은 관리자 승인 후 처리됩니다.</li>
                <li>승인까지 영업일 기준 3-5일이 소요될 수 있습니다.</li>
                <li>정산 수수료는 별도로 부과되지 않습니다.</li>
                <li>계좌번호는 정확하게 입력해주세요.</li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="submit"
                className="flex-1"
                disabled={submitting || stats.pending_earnings < MIN_SETTLEMENT}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    처리중...
                  </>
                ) : (
                  '정산 요청하기'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/partner/dashboard')}
              >
                취소
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">수익 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">총 수익</span>
            <span className="font-medium">{stats.total_earnings.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">지급 완료</span>
            <span className="font-medium text-green-600">{stats.paid_earnings.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-muted-foreground">정산 가능</span>
            <span className="font-bold text-primary">{stats.pending_earnings.toLocaleString()}원</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
