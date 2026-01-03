'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, LayoutDashboard, Receipt, DollarSign } from 'lucide-react'
import Link from 'next/link'

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [isPartner, setIsPartner] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkPartnerStatus()
  }, [])

  const checkPartnerStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_partner')
        .eq('id', user.id)
        .single()

      if (!profile?.is_partner) {
        alert('파트너 전용 페이지입니다.\n\n파트너 권한이 필요하신 경우, 관리자에게 문의해주세요.')
        router.push('/')
        return
      }

      setIsPartner(true)
    } catch (error) {
      console.error('Failed to check partner status:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isPartner) {
    return null
  }

  const navItems = [
    { href: '/partner/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/partner/settlements', label: '정산 내역', icon: Receipt },
    { href: '/partner/request-settlement', label: '정산 요청', icon: DollarSign },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-purple-600">✨</span>
              파트너 센터
            </h1>
            <Link 
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
