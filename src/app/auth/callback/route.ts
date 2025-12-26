import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const referralCode = requestUrl.searchParams.get('referral_code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code)

    // If referral code exists and user just signed up, link to partner
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
  }

  // 로그인 성공 후 홈으로 리다이렉트
  return NextResponse.redirect(`${origin}/`)
}
