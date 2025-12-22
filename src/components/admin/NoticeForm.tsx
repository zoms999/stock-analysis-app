'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type NoticeFormProps = {
  initialData?: {
    id: string
    title: string
    content: string
    is_important: boolean
    is_popup: boolean
  }
}

export default function NoticeForm({ initialData }: NoticeFormProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [content, setContent] = useState(initialData?.content || '')
  const [isImportant, setIsImportant] = useState(initialData?.is_important || false)
  const [isPopup, setIsPopup] = useState(initialData?.is_popup || false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('로그인이 필요합니다.')
      }

      if (initialData) {
        // Update
        const { error } = await supabase
          .from('notices')
          .update({
            title,
            content,
            is_important: isImportant,
            is_popup: isPopup,
            updated_at: new Date().toISOString()
          })
          .eq('id', initialData.id)
        if (error) throw error
        alert('공지사항이 수정되었습니다.')
      } else {
        // Create
        const { error } = await supabase
          .from('notices')
          .insert({
            title,
            content,
            is_important: isImportant,
            is_popup: isPopup,
            author_id: user.id
          })
        if (error) throw error
        alert('공지사항이 등록되었습니다.')
      }
      router.push('/admin/notices')
      router.refresh()
    } catch (error: any) {
      console.error(error)
      alert('오류 발생: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border rounded-md p-2 text-sm"
          required
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(e) => setIsImportant(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>상단 고정 (Important)</span>
        </label>

        <label className="flex items-center space-x-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isPopup}
            onChange={(e) => setIsPopup(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span>팝업 노출 (Popup)</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={15}
          className="w-full border rounded-md p-2 text-sm font-mono"
          required
        />
        <p className="text-xs text-gray-400 mt-1">Markdown 형식을 지원할 수 있습니다.</p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? '저장 중...' : (initialData ? '수정하기' : '등록하기')}
        </button>
      </div>
    </form>
  )
}
