
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'

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
    redirect('/login?error=로그인에_실패했습니다')
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

  // 비밀번호 유효성 검사
  if (password.length < 6) {
    redirect('/login?error=비밀번호는_6자_이상이어야_합니다')
  }

  const siteUrl = await getSiteUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname: nickname || `User_${Date.now()}`,
      },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    }
  })

  if (error) {
    console.error('Signup Error:', error)
    redirect('/login?error=회원가입에_실패했습니다')
  }

  // 이메일 확인이 필요한 경우
  if (data.user && !data.session) {
    redirect('/login?message=이메일_확인이_필요합니다')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const siteUrl = await getSiteUrl()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    }
  })

  if (error) {
    console.error('Google Login Error:', error)
    redirect('/login?error=구글_로그인에_실패했습니다')
  }

  if (data.url) {
    redirect(data.url)
  }
}

export async function signInWithFacebook() {
  const supabase = await createClient()
  const siteUrl = await getSiteUrl()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
      scopes: 'public_profile,email',
    }
  })

  if (error) {
    console.error('Facebook Login Error:', error)
    redirect('/login?error=페이스북_로그인에_실패했습니다')
  }

  if (data.url) {
    redirect(data.url)
  }
}
