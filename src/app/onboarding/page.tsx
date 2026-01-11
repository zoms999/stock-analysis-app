'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Check if user is logged in and already has a valid nickname
    async function checkNickname() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()

      // If user already has a valid nickname (not auto-generated), redirect to home
      if (profile?.nickname && !profile.nickname.startsWith('User_')) {
        router.push('/')
        return
      }

      setIsChecking(false)
    }

    checkNickname()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedNickname = nickname.trim()
    if (!trimmedNickname) {
      toast.error('닉네임을 입력해주세요')
      return
    }

    if (trimmedNickname.length < 2) {
      toast.error('닉네임은 2자 이상이어야 합니다')
      return
    }

    if (trimmedNickname.length > 20) {
      toast.error('닉네임은 20자 이하여야 합니다')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/profile/update-nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmedNickname })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '닉네임 설정에 실패했습니다')
      }

      toast.success('닉네임이 설정되었습니다!')
      router.push('/')
    } catch (error: any) {
      toast.error(error.message || '닉네임 설정에 실패했습니다')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">환영합니다! 🎉</h1>
          <p className="text-muted-foreground">
            InvestComm에서 사용할 닉네임을 설정해주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nickname" className="text-sm font-medium">
              닉네임
            </label>
            <Input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              className="mt-1"
              maxLength={20}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              2-20자 사이로 입력해주세요
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || !nickname.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                설정 중...
              </>
            ) : (
              '시작하기'
            )}
          </Button>
        </form>
      </Card>
    </div>
  )
}
