import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const referralCodeFromQuery = requestUrl.searchParams.get('referral_code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    // If referral code exists and user just signed up, link to partner
    const normalizeReferralCode = (value: unknown) => {
      if (typeof value !== 'string') return null
      const v = value.trim()

      // 신규: 4자리 숫자
      const digits = v.replace(/\D/g, '')
      if (/^\d{4}$/.test(digits)) return digits

      // 레거시 호환(기존 8자리 코드가 남아있을 수 있음)
      const legacy = v.toUpperCase()
      if (/^[A-Z0-9]{8}$/.test(legacy)) return legacy

      return null
    }

    const referralCode =
      normalizeReferralCode(referralCodeFromQuery) ||
      normalizeReferralCode((sessionData as any)?.user?.user_metadata?.referral_code)

    if (referralCode && sessionData?.user) {
      const userId = sessionData.user.id

      // Check if user already has a referrer
      const { data: profile } = await supabase
        .from('profiles')
        .select('referred_by')
        .eq('id', userId)
        .single()

      // Only update if referred_by is null (new user or not yet linked)
      if (profile && !profile.referred_by) {
        // Find partner by referral code
        const { data: partner } = await supabase
          .from('profiles')
          .select('id')
          .eq('referral_code', referralCode)
          .single()

        if (partner) {
          // Update user's referred_by
          await supabase
            .from('profiles')
            .update({ referred_by: partner.id })
            .eq('id', userId)
        }
      }
    }

    // Check if user needs to set a nickname (OAuth users)
    if (sessionData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', sessionData.user.id)
        .single()

      // If nickname is missing or auto-generated (starts with "User_"), redirect to onboarding
      if (!profile?.nickname || profile.nickname.startsWith('User_')) {
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }
  }

  // 로그인 성공 후 홈으로 리다이렉트
  return NextResponse.redirect(`${origin}/`)
}
