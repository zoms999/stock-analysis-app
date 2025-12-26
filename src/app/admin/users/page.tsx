'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
        // Search by nickname or referral_code directly
        // Note: searching by email might require a different approach if email is not in profiles
        // Assuming email IS in profiles for now as per plan
        query = query.or(`nickname.ilike.%${searchTerm}%,referral_code.ilike.%${searchTerm}%`)
        
        // If email is in profiles, add it to OR clause:
        // query = query.or(`email.ilike.%${searchTerm}%,nickname.ilike.%${searchTerm}%`)
      }

      const { data, count, error } = await query

      if (error) throw error

      setUsers(data || [])
      if (count) {
        setTotalPages(Math.ceil(count / ITEMS_PER_PAGE))
      }
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
      fetchUsers() // Refresh list
    } catch (error) {
      console.error('Error updating level:', error)
      alert('등급 수정 실패')
    } finally {
      setUpdateLoading(false)
    }
  }

  const handleTogglePartner = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? '해제' : '승격'
    if (!confirm(`정말로 이 회원을 파트너로 ${action}하시겠습니까?`)) {
      return
    }

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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">회원 관리</h1>
        <div className="flex gap-2">
           <input
            type="text"
            placeholder="닉네임, 추천코드 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-64"
          />
          <button 
            onClick={() => setPage(1)}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
          >
            검색
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">가입일</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이메일/ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">닉네임</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">추천코드</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">레벨</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.email || <span className="text-gray-400">UUID: {user.id.slice(0, 8)}...</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.nickname || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.referral_code || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.user_level === 10 ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      LV {user.user_level}
                    </span>
                    {user.is_partner && (
                      <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        파트너
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button 
                      onClick={() => handleEditClick(user)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      등급 수정
                    </button>
                    <button 
                      onClick={() => handleTogglePartner(user.id, user.is_partner || false)}
                      className={`${
                        user.is_partner 
                          ? 'text-red-600 hover:text-red-900' 
                          : 'text-green-600 hover:text-green-900'
                      }`}
                    >
                      {user.is_partner ? '파트너 해제' : '파트너 승격'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="mt-4 flex justify-center space-x-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 rounded border disabled:opacity-50 settings-btn"
        >
          이전
        </button>
        <span className="px-3 py-1 text-sm text-gray-700 self-center">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-1 rounded border disabled:opacity-50 settings-btn"
        >
          다음
        </button>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-bold mb-4">회원 등급 수정</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">대상: {editingUser.nickname || editingUser.id}</p>
              <label className="block text-sm font-medium text-gray-700 mb-1">레벨 (1-10)</label>
              <input 
                type="number" 
                min="1" 
                max="10" 
                value={editLevel} 
                onChange={(e) => setEditLevel(Number(e.target.value))}
                className="w-full border rounded p-2"
              />
              <p className="text-xs text-gray-400 mt-1">* 레벨 10은 관리자 권한입니다.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                취소
              </button>
              <button 
                onClick={handleUpdateLevel}
                disabled={updateLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateLoading ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
