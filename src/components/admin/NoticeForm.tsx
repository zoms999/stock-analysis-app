'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

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
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {initialData ? "공지사항 수정" : "새 공지사항 작성"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">제목</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="공지 제목을 입력하세요"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isImportant}
                onChange={(e) => setIsImportant(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>상단 고정 (Important)</span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPopup}
                onChange={(e) => setIsPopup(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>팝업 노출 (Popup)</span>
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">내용</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={15}
              className="font-mono"
              required
              placeholder="내용을 입력하세요"
            />
            <p className="text-xs text-muted-foreground">
              Markdown 형식을 지원할 수 있습니다.
            </p>
          </div>
        </CardContent>

        <CardFooter className="justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            취소
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "저장 중..." : initialData ? "수정하기" : "등록하기"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
