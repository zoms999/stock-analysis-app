import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ProfileLite = {
  nickname: string | null;
  avatar_url: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
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

export async function PATCH(req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ ok: false, error: "INVALID_COMMENT_ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ ok: false, error: "EMPTY_CONTENT" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ ok: false, error: "TOO_LONG" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("post_comments")
    .update({ content })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select(
      `
      id,
      post_id,
      user_id,
      content,
      created_at,
      updated_at,
      profiles:user_id (
        nickname,
        avatar_url
      )
    `
    )
    .maybeSingle();

  if (error) {
    console.error("PATCH comment error:", error);
    return NextResponse.json({ ok: false, error: "FAILED_TO_UPDATE" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, comment: normalizeCommentRow(data as CommentRowRaw) }, { status: 200 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const { commentId } = await params;
  if (!commentId) {
    return NextResponse.json({ ok: false, error: "INVALID_COMMENT_ID" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("DELETE comment error:", error);
    return NextResponse.json({ ok: false, error: "FAILED_TO_DELETE" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN_OR_NOT_FOUND" }, { status: 403 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}


