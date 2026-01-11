
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'

function redirectWithMessage(params: { error?: string; message?: string }) {
  const qs = new URLSearchParams()
  if (params.error) qs.set('error', params.error)
  if (params.message) qs.set('message', params.message)
  redirect(`/login?${qs.toString()}`)
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Login Error:', error)
    // 이메일 인증이 필요한 경우(회원가입 후 미확인)
    if ((error as any)?.code === 'email_not_confirmed') {
      redirectWithMessage({ message: '이메일 확인(인증) 후 로그인해주세요' })
    }

    redirectWithMessage({ error: '로그인에 실패했습니다' })
  }

  revalidatePath('/', 'layout')
  redirect('/')
}


async function getSiteUrl() {
  // 1. First priority: Check Host header
  const headersList = await headers();
  const host = headersList.get('host') || '';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
     return `http://${host}`;
  }

  // 2. Second priority: Environment variable (standard compliant)
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  // 3. Fallback: Production URL
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://stock-analysis-app-two.vercel.app';
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nickname = formData.get('nickname') as string
  const referralCode = formData.get('referral_code') as string

  // 비밀번호 유효성 검사
  if (password.length < 6) {
    redirectWithMessage({ error: '비밀번호는 6자 이상이어야 합니다' })
  }

  if (!nickname || nickname.trim().length === 0) {
    redirectWithMessage({ error: '닉네임을 입력해주세요' })
  }

  const siteUrl = await getSiteUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname: nickname || `User_${Date.now()}`,
        referral_code: referralCode || null,
      },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    }
  })

  if (error) {
    console.error('Signup Error:', error)
    redirectWithMessage({ error: '회원가입에 실패했습니다' })
  }

  // 이메일 확인이 필요한 경우
  if (data.user && !data.session) {
    redirectWithMessage({ message: '이메일 확인이 필요합니다' })
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient()
  const siteUrl = await getSiteUrl()
  const referralCode = formData.get('referral_code') as string

  // Build redirect URL with referral code if present
  let redirectUrl = `${siteUrl}/auth/callback`
  if (referralCode) {
    redirectUrl += `?referral_code=${encodeURIComponent(referralCode)}`
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
    }
  })

  if (error) {
    console.error('Google Login Error:', error)
    redirectWithMessage({ error: '구글 로그인에 실패했습니다' })
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signInWithFacebook(formData: FormData) {
  const supabase = await createClient()
  const siteUrl = await getSiteUrl()
  const referralCode = formData.get('referral_code') as string

  // Build redirect URL with referral code if present
  let redirectUrl = `${siteUrl}/auth/callback`
  if (referralCode) {
    redirectUrl += `?referral_code=${encodeURIComponent(referralCode)}`
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: redirectUrl,
      scopes: 'public_profile,email',
    }
  })

  if (error) {
    console.error('Facebook Login Error:', error)
    redirectWithMessage({ error: '페이스북 로그인에 실패했습니다' })
  }

  if (data.url) {
    redirect(data.url)
  }
}
