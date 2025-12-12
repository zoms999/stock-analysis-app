
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

export async function signup(formData: FormData) {
  const supabase = await createClient()
  
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nickname = formData.get('nickname') as string

  // 비밀번호 유효성 검사
  if (password.length < 6) {
    redirect('/login?error=비밀번호는_6자_이상이어야_합니다')
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname: nickname || `User_${Date.now()}`,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
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
  const origin = (await headers()).get('origin') || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
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
  const origin = (await headers()).get('origin') || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${origin}/auth/callback`,
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
