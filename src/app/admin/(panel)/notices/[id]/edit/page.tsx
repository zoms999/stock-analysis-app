'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NoticeForm from '@/components/admin/NoticeForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

type NoticeRow = {
  id: string
  title: string
  content: string
  category: string
  is_important: boolean
  is_active: boolean
  is_popup: boolean
  author_id: string
  view_count: number
  created_at: string
  updated_at: string
}

export default function AdminNoticeEditPage() {
  const params = useParams()
  const id = String((params as any)?.id || '')

  const [notice, setNotice] = useState<NoticeRow | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchNotice = async () => {
      if (!id) return

      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching notice:', error)
        alert(`공지사항을 불러오지 못했습니다: ${error.message}`)
      } else if (data) {
        setNotice(data)
      } else {
        alert('공지사항을 찾을 수 없습니다.')
      }
      setLoading(false)
    }

    fetchNotice()
  }, [id])

  if (loading) return <div className="text-sm text-muted-foreground">로딩 중...</div>
  if (!notice) return <div className="text-sm text-muted-foreground">데이터 없음</div>

  return (
    <div>
      <AdminPageHeader title="공지사항 수정" />
      <NoticeForm initialData={notice} />
    </div>
  )
}







