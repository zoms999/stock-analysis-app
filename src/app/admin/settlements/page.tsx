'use client'

import { useState, useEffect } from 'react'
import { getPendingSettlements, markSettlementPaid, Settlement } from '@/lib/api/admin-partners'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DollarSign, CheckCircle, Clock } from 'lucide-react'

export default function AdminSettlementsPage() {
  const [loading, setLoading] = useState(true)
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    fetchSettlements()
  }, [])

  const fetchSettlements = async () => {
    setLoading(true)
    try {
      const data = await getPendingSettlements()
      setSettlements(data)
    } catch (error) {
      console.error('Failed to fetch settlements:', error)
      alert('정산 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsPaid = async (settlementId: string) => {
    if (!confirm('정말로 이 정산을 지급 완료 처리하시겠습니까?')) {
      return
    }

    setProcessing(settlementId)
    try {
      await markSettlementPaid(settlementId)
      alert('정산이 지급 완료 처리되었습니다.')
      fetchSettlements()
    } catch (error) {
      console.error('Failed to mark settlement as paid:', error)
      alert('정산 처리에 실패했습니다.')
    } finally {
      setProcessing(null)
    }
  }

  const totalPending = settlements.reduce((sum, s) => sum + s.settlement_amount, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
        <p className="text-sm text-gray-500 mt-1">파트너 정산 내역을 관리합니다.</p>
      </div>

      {/* Summary Card */}
      <div className="mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">미지급 정산 총액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-500" />
              <span className="text-3xl font-bold">{totalPending.toLocaleString()}원</span>
              <span className="text-sm text-gray-500">({settlements.length}건)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settlements Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">발생일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">파트너</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제금액</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수수료율</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">정산금액</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : settlements.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>미지급 정산 내역이 없습니다.</p>
                </td>
              </tr>
            ) : (
              settlements.map((settlement) => (
                <tr key={settlement.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(settlement.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{settlement.partner_name}</div>
                      <div className="text-sm text-gray-500">{settlement.partner_email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {settlement.source_user_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {settlement.payment_amount.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {settlement.commission_rate}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {settlement.settlement_amount.toLocaleString()}원
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      onClick={() => handleMarkAsPaid(settlement.id)}
                      disabled={processing === settlement.id}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing === settlement.id ? (
                        '처리중...'
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          지급완료
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
