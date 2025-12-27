'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminTableCard } from '@/components/admin/AdminTable'
import { Button } from '@/components/ui/button'

type Notice = {
  id: string
  title: string
  is_important: boolean
  is_popup: boolean
  view_count: number
  created_at: string
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    fetchNotices()
  }, [])

  const fetchNotices = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notices:', error)
      alert('공지사항을 불러오지 못했습니다.')
    } else {
      setNotices(data || [])
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    const { error } = await supabase.from('notices').delete().eq('id', id)

    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      alert('삭제되었습니다.')
      fetchNotices()
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="공지사항 관리"
        description="공지사항을 작성하고 관리합니다."
        actions={
          <Button onClick={() => router.push('/admin/notices/create')}>
            새 공지 작성
          </Button>
        }
      />

      <AdminTableCard>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                제목
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                작성일
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                조회수
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : notices.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  등록된 공지사항이 없습니다.
                </td>
              </tr>
            ) : (
              notices.map((notice) => (
                <tr key={notice.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/notices/${notice.id}`}
                      target="_blank"
                      className="font-medium hover:underline"
                    >
                      {notice.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    {notice.is_important && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-destructive/10 text-destructive">
                        중요
                      </span>
                    )}
                    {notice.is_popup && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-primary/10 text-primary">
                        팝업
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {new Date(notice.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {notice.view_count}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => router.push(`/admin/notices/${notice.id}/edit`)}
                      >
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-destructive"
                        onClick={() => handleDelete(notice.id)}
                      >
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminTableCard>
    </div>
  )
}




