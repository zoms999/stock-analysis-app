'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NoticeForm from '@/components/admin/NoticeForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default function AdminNoticeEditPage({ params }: { params: { id: string } }) {
  const [notice, setNotice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchNotice = async () => {
      const { data } = await supabase
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

  if (loading) return <div className="text-sm text-muted-foreground">로딩 중...</div>
  if (!notice) return <div className="text-sm text-muted-foreground">데이터 없음</div>

  return (
    <div>
      <AdminPageHeader title="공지사항 수정" />
      <NoticeForm initialData={notice} />
    </div>
  )
}







