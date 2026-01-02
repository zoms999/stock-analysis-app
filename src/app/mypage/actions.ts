'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateReferralCode(userId: string) {
  const supabase = await createClient()

  // 이미 추천인 코드가 있으면 그대로 반환(재발급 방지)
  const { data: existingProfile, error: existingError } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .maybeSingle()

  if (existingError) {
    // eslint-disable-next-line no-console
    console.error('Failed to fetch existing referral code:', existingError)
    throw new Error('Failed to generate referral code')
  }

  if (existingProfile?.referral_code) {
    return existingProfile.referral_code
  }

  // 4자리 숫자 코드(0000~9999). UNIQUE 제약(중복) 발생 시 재시도합니다.
  const maxAttempts = 30
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')

    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: code })
      .eq('id', userId)

    if (!error) {
      revalidatePath('/mypage')
      return code
    }

    // UNIQUE 충돌(중복 코드)인 경우에만 재시도
    const pgCode = (error as any)?.code
    const msg = (error as any)?.message as string | undefined
    const isUniqueViolation =
      pgCode === '23505' || (typeof msg === 'string' && msg.includes('duplicate key'))

    if (!isUniqueViolation) {
      // eslint-disable-next-line no-console
      console.error('Failed to generate referral code:', error)
      throw new Error('Failed to generate referral code')
    }
  }

  throw new Error('Failed to generate referral code')
}
