'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminTableCard } from '@/components/admin/AdminTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type PredictionStatus = 'WAITING' | 'SUCCESS' | 'FAIL' | 'TIMEOUT' | null

type AdminPostRow = {
  id: string
  user_id: string
  title: string
  ticker_symbol: string
  required_level: number | null
  view_count: number | null
  created_at: string
  prediction_status: PredictionStatus
  accuracy_score: number | null
  profiles?: { nickname: string | null } | null
}

type SortKey = 'latest' | 'views' | 'accuracy' | 'completed'
type StatusFilter = 'ALL' | 'NONE' | 'WAITING' | 'SUCCESS' | 'FAIL' | 'TIMEOUT'

export default function AdminPostsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<AdminPostRow[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState<SortKey>('latest')
  const [status, setStatus] = useState<StatusFilter>('ALL')

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const ITEMS_PER_PAGE = 20

  // Edit modal
  const [editing, setEditing] = useState<AdminPostRow | null>(null)
  const [editRequiredLevel, setEditRequiredLevel] = useState<number>(1)
  const [editStatus, setEditStatus] = useState<PredictionStatus>(null)
  const [updating, setUpdating] = useState(false)

  const sortLabel = useMemo(() => {
    switch (sort) {
      case 'views':
        return '조회수'
      case 'accuracy':
        return '정확도'
      case 'completed':
        return '완료(예측 종료)'
      case 'latest':
      default:
        return '최신'
    }
  }, [sort])

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, status, searchTerm])

  const fetchPosts = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('posts')
        .select(
          `
          id,
          user_id,
          title,
          ticker_symbol,
          required_level,
          view_count,
          created_at,
          prediction_status,
          accuracy_score,
          profiles:user_id (
            nickname
          )
        `,
          { count: 'exact' }
        )
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      // 검색: 제목/종목 코드 중심
      if (searchTerm.trim()) {
        const term = searchTerm.trim()
        query = query.or(`title.ilike.%${term}%,ticker_symbol.ilike.%${term}%`)
      }

      // 상태 필터
      if (status === 'NONE') query = query.is('prediction_status', null)
      else if (status !== 'ALL') query = query.eq('prediction_status', status)

      // 정렬
      if (sort === 'views') query = query.order('view_count', { ascending: false })
      else if (sort === 'accuracy') query = query.order('accuracy_score', { ascending: false, nullsFirst: false })
      else if (sort === 'completed') {
        query = query.neq('prediction_status', 'WAITING').order('target_date', { ascending: false, nullsFirst: false })
      } else query = query.order('created_at', { ascending: false })

      const { data, count, error } = await query
      if (error) throw error

      setPosts((data as unknown as AdminPostRow[]) || [])
      if (typeof count === 'number') setTotalPages(Math.max(1, Math.ceil(count / ITEMS_PER_PAGE)))
    } catch (e) {
      console.error('Error fetching admin posts:', e)
      alert('게시글 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (post: AdminPostRow) => {
    setEditing(post)
    setEditRequiredLevel(Number(post.required_level ?? 1))
    setEditStatus(post.prediction_status ?? null)
  }

  const saveEdit = async () => {
    if (!editing) return
    setUpdating(true)
    try {
      const payload: Record<string, unknown> = {
        required_level: Math.min(10, Math.max(1, editRequiredLevel)),
        prediction_status: editStatus,
      }

      const { error } = await supabase.from('posts').update(payload).eq('id', editing.id)
      if (error) throw error

      alert('게시글 정보가 수정되었습니다.')
      setEditing(null)
      await fetchPosts()
    } catch (e: any) {
      console.error('Error updating post:', e)
      alert(`수정 실패: ${e?.message || '알 수 없는 오류'}`)
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async (post: AdminPostRow) => {
    if (!confirm(`정말 삭제하시겠습니까?\n\n- 제목: ${post.title}\n- 종목: ${post.ticker_symbol}`)) return

    try {
      const { error } = await supabase.from('posts').delete().eq('id', post.id)
      if (error) throw error

      alert('삭제되었습니다.')
      await fetchPosts()
    } catch (e: any) {
      console.error('Error deleting post:', e)
      alert(`삭제 실패: ${e?.message || '알 수 없는 오류'}`)
    }
  }

  const statusBadge = (s: PredictionStatus) => {
    if (!s) return <span className="px-2 py-0.5 text-xs font-medium rounded bg-muted text-muted-foreground">일반</span>
    if (s === 'WAITING') return <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-500/10 text-blue-700">대기</span>
    if (s === 'SUCCESS') return <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-700">성공</span>
    if (s === 'FAIL') return <span className="px-2 py-0.5 text-xs font-medium rounded bg-destructive/10 text-destructive">실패</span>
    return <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-500/10 text-amber-700">타임아웃</span>
  }

  return (
    <div>
      <AdminPageHeader
        title="게시글 관리"
        description="게시글을 검색/정렬하고, 레벨/상태 수정 및 삭제를 할 수 있습니다."
        actions={
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <Input
              value={searchTerm}
              onChange={(e) => {
                setPage(1)
                setSearchTerm(e.target.value)
              }}
              placeholder="제목/종목 검색"
              className="w-64"
            />
            <select
              value={sort}
              onChange={(e) => {
                setPage(1)
                setSort(e.target.value as SortKey)
              }}
              aria-label="정렬"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="latest">최신</option>
              <option value="views">조회수</option>
              <option value="accuracy">정확도</option>
              <option value="completed">완료(예측 종료)</option>
            </select>
            <select
              value={status}
              onChange={(e) => {
                setPage(1)
                setStatus(e.target.value as StatusFilter)
              }}
              aria-label="상태"
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="ALL">상태: 전체</option>
              <option value="NONE">상태: 일반(예측 없음)</option>
              <option value="WAITING">상태: 대기</option>
              <option value="SUCCESS">상태: 성공</option>
              <option value="FAIL">상태: 실패</option>
              <option value="TIMEOUT">상태: 타임아웃</option>
            </select>
            <Button variant="outline" onClick={() => fetchPosts()}>
              새로고침
            </Button>
            <span className="text-xs text-muted-foreground md:ml-2">
              정렬: {sortLabel}
            </span>
          </div>
        }
      />

      <AdminTableCard>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                작성일
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                종목
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                제목
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                작성자
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                레벨
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                상태
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
                <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              posts.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-semibold">
                      {p.ticker_symbol}
                    </span>
                  </td>
                  <td className="px-6 py-4 min-w-[320px]">
                    <Link
                      href={`/posts/${p.id}`}
                      target="_blank"
                      className="font-medium hover:underline line-clamp-1"
                      title={p.title}
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-1">ID: {p.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {p.profiles?.nickname || p.user_id.slice(0, 8) + '…'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-500/10 text-emerald-700">
                      LV {p.required_level ?? 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{statusBadge(p.prediction_status ?? null)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{p.view_count ?? 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button size="sm" variant="link" className="h-auto p-0" onClick={() => openEdit(p)}>
                        수정
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0 text-destructive"
                        onClick={() => handleDelete(p)}
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

      {/* Pagination */}
      <div className="mt-4 flex justify-center items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          이전
        </Button>
        <span className="px-2 text-sm text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          다음
        </Button>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-xl">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">게시글 수정</h3>
              <p className="text-sm text-muted-foreground mt-1">
                대상: {editing.title} ({editing.ticker_symbol})
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">열람 레벨(1~10)</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={editRequiredLevel}
                  onChange={(e) => setEditRequiredLevel(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">예측 상태</label>
                <select
                  value={editStatus ?? ''}
                  onChange={(e) => setEditStatus((e.target.value || null) as PredictionStatus)}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">일반(예측 없음)</option>
                  <option value="WAITING">대기</option>
                  <option value="SUCCESS">성공</option>
                  <option value="FAIL">실패</option>
                  <option value="TIMEOUT">타임아웃</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  * 일반 게시글이면 “일반(예측 없음)”으로 두세요.
                </p>
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                취소
              </Button>
              <Button onClick={saveEdit} disabled={updating}>
                {updating ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}







