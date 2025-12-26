'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function generateReferralCode(userId: string) {
  const supabase = await createClient()

  // Generate a random 8-character string
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

  const { error } = await supabase
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', userId)

  if (error) {
    console.error('Failed to generate referral code:', error)
    throw new Error('Failed to generate referral code')
  }

  revalidatePath('/mypage')
  return code
}
