'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NoticeForm from '@/components/admin/NoticeForm'

export default function AdminNoticeEditPage({ params }: { params: { id: string } }) {
  const [notice, setNotice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchNotice = async () => {
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('id', params.id)
        .single()
      
      if (data) {
        setNotice(data)
      } else {
        alert('공지사항을 찾을 수 없습니다.')
      }
      setLoading(false)
    }

    fetchNotice()
  }, [params.id])

  if (loading) return <div>로딩 중...</div>
  if (!notice) return <div>데이터 없음</div>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">공지사항 수정</h1>
      <NoticeForm initialData={notice} />
    </div>
  )
}
