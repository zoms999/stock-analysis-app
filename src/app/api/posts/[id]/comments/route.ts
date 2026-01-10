import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ProfileLite = {
  nickname: string | null;
  avatar_url: string | null;
  country_code: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  parent_comment_id: string | null;
  profiles?: ProfileLite | null;
};

type CommentRowRaw = Omit<CommentRow, "profiles"> & {
  profiles?: ProfileLite | ProfileLite[] | null;
};

function normalizeCommentRow(row: CommentRowRaw): CommentRow {
  const p = row.profiles;
  const profiles = Array.isArray(p) ? p[0] ?? null : p ?? null;
  return { ...row, profiles };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_POST_ID" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("post_comments")
    .select(
      `
      id,
      post_id,
      user_id,
      content,
      created_at,
      updated_at,
      parent_comment_id,
      profiles:user_id (
        nickname,
        avatar_url,
        country_code
      )
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("GET comments error:", error);
    return NextResponse.json({ ok: false, error: "FAILED_TO_FETCH" }, { status: 500 });
  }

  const normalized = ((data ?? []) as CommentRowRaw[]).map(normalizeCommentRow);
  return NextResponse.json({ ok: true, comments: normalized }, { status: 200 });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  if (!postId) {
    return NextResponse.json({ ok: false, error: "INVALID_POST_ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { content?: unknown; parent_comment_id?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const parentCommentId = typeof body.parent_comment_id === "string" ? body.parent_comment_id : null;

  if (!content) {
    return NextResponse.json({ ok: false, error: "EMPTY_CONTENT" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ ok: false, error: "TOO_LONG" }, { status: 400 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      content,
      parent_comment_id: parentCommentId,
    })
    .select(
      `
      id,
      post_id,
      user_id,
      content,
      created_at,
      updated_at,
      parent_comment_id,
      profiles:user_id (
        nickname,
        avatar_url,
        country_code
      )
    `
    )
    .single();

  if (insertError) {
    console.error("POST comment error:", insertError);
    return NextResponse.json({ ok: false, error: "FAILED_TO_CREATE" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, comment: normalizeCommentRow(inserted as CommentRowRaw) },
    { status: 200 }
  );
}


