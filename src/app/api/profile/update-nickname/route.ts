import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get nickname from request body
    const body = await request.json()
    const nickname = body.nickname?.trim()

    if (!nickname) {
      return NextResponse.json(
        { error: '닉네임을 입력해주세요' },
        { status: 400 }
      )
    }

    if (nickname.length < 2) {
      return NextResponse.json(
        { error: '닉네임은 2자 이상이어야 합니다' },
        { status: 400 }
      )
    }

    if (nickname.length > 20) {
      return NextResponse.json(
        { error: '닉네임은 20자 이하여야 합니다' },
        { status: 400 }
      )
    }

    // Check if nickname is already taken
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', nickname)
      .neq('id', user.id)
      .maybeSingle()

    if (existingProfile) {
      return NextResponse.json(
        { error: '이미 사용 중인 닉네임입니다' },
        { status: 400 }
      )
    }

    // Update user's nickname
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ nickname })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating nickname:', updateError)
      return NextResponse.json(
        { error: '닉네임 업데이트에 실패했습니다' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in update-nickname:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
