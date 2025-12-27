"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export function SubscriptionSync() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const onceRef = useRef(false)

  useEffect(() => {
    const success = searchParams.get("success")
    const sessionId = searchParams.get("session_id")

    if (onceRef.current) return
    if (success !== "true" || !sessionId) return

    onceRef.current = true
    setSyncing(true)

    ;(async () => {
      try {
        const res = await fetch("/api/stripe/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data?.error || "구독 동기화에 실패했습니다.")
        }

        toast.success("구독 정보가 반영되었습니다.")
        // 마이페이지로 이동해서 바로 확인 가능하게
        router.replace("/mypage")
        router.refresh()
      } catch (e: any) {
        toast.error(e?.message || "구독 동기화에 실패했습니다.")
      } finally {
        setSyncing(false)
      }
    })()
  }, [router, searchParams])

  if (!syncing) return null

  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      결제 확인 중… 잠시만 기다려주세요.
    </div>
  )
}





