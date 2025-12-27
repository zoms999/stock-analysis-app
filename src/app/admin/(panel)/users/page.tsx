'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminTableCard } from '@/components/admin/AdminTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Profile = {
  id: string
  email: string | null
  nickname: string | null
  user_level: number
  created_at: string
  referral_code: string | null
  is_partner: boolean
}

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<Profile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const ITEMS_PER_PAGE = 20

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editLevel, setEditLevel] = useState<number>(1)
  const [updateLoading, setUpdateLoading] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      if (searchTerm) {
        query = query.or(`nickname.ilike.%${searchTerm}%,referral_code.ilike.%${searchTerm}%`)
      }

      const { data, count, error } = await query
      if (error) throw error

      setUsers(data || [])
      if (count) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE))
    } catch (error) {
      console.error('Error fetching users:', error)
      alert('회원 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleEditClick = (user: Profile) => {
    setEditingUser(user)
    setEditLevel(user.user_level)
  }

  const handleUpdateLevel = async () => {
    if (!editingUser) return
    setUpdateLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ user_level: editLevel })
        .eq('id', editingUser.id)

      if (error) throw error

      alert('회원 등급이 수정되었습니다.')
      setEditingUser(null)
      fetchUsers()
    } catch (error) {
      console.error('Error updating level:', error)
      alert('등급 수정 실패')
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleTogglePartner = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? '해제' : '승격'
    if (!confirm(`정말로 이 회원을 파트너로 ${action}하시겠습니까?`)) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_partner: !currentStatus })
        .eq('id', userId)

      if (error) throw error

      alert(`파트너 ${action}이 완료되었습니다.`)
      fetchUsers()
    } catch (error) {
      console.error('Error toggling partner:', error)
      alert('파트너 상태 변경에 실패했습니다.')
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="회원 관리"
        actions={
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="닉네임, 추천코드 검색"
              className="w-64"
            />
            <Button onClick={() => setPage(1)}>검색</Button>
          </div>
        }
      />

      <AdminTableCard>
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                가입일
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                이메일/ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                닉네임
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                추천코드
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                레벨
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                관리
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  로딩 중...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-b-0 hover:bg-muted/40">
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.email || (
                      <span className="text-muted-foreground">
                        UUID: {user.id.slice(0, 8)}...
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{user.nickname || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {user.referral_code || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={[
                        'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                        user.user_level === 10
                          ? 'bg-primary/10 text-primary'
                          : 'bg-emerald-500/10 text-emerald-700',
                      ].join(' ')}
                    >
                      LV {user.user_level}
                    </span>
                    {user.is_partner && (
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-500/10 text-amber-700">
                        파트너
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => handleEditClick(user)}
                      >
                        등급 수정
                      </Button>
                      <Button
                        size="sm"
                        variant="link"
                        className={[
                          'h-auto p-0',
                          user.is_partner ? 'text-destructive' : 'text-emerald-700',
                        ].join(' ')}
                        onClick={() => handleTogglePartner(user.id, user.is_partner || false)}
                      >
                        {user.is_partner ? '파트너 해제' : '파트너 승격'}
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
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-xl">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">회원 등급 수정</h3>
              <p className="text-sm text-muted-foreground mt-1">
                대상: {editingUser.nickname || editingUser.id}
              </p>
            </div>
            <div className="p-6 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">레벨 (1-10)</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={editLevel}
                  onChange={(e) => setEditLevel(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  * 레벨 10은 관리자 권한입니다.
                </p>
              </div>
            </div>
            <div className="p-6 pt-0 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                취소
              </Button>
              <Button onClick={handleUpdateLevel} disabled={updateLoading}>
                {updateLoading ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


