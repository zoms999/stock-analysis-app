import { createClient } from "@/lib/supabase/client";

export type NoticeCategory = "GENERAL" | "SYSTEM" | "EVENT";

export interface Notice {
  id: string;
  title: string;
  content: string;
  category: NoticeCategory;
  is_important: boolean;
  is_active: boolean;
  is_popup: boolean;
  author_id: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  // Relations
  profiles?: {
    nickname: string;
    avatar_url?: string;
  };
}

/**
 * Fetch all active notices
 * Important notices appear first, then sorted by created_at desc
 */
export async function fetchNotices(): Promise<Notice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notices")
    .select(`
      *,
      profiles:author_id (
        nickname,
        avatar_url
      )
    `)
    .eq("is_active", true)
    .order("is_important", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notices:", error);
    return [];
  }

  return data || [];
}

/**
 * Fetch a single notice by ID and increment view count
 */
export async function fetchNoticeById(id: string): Promise<Notice | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notices")
    .select(`
      *,
      profiles:author_id (
        nickname,
        avatar_url
      )
    `)
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Error fetching notice:", error);
    return null;
  }

  // Increment view count
  await supabase
    .from("notices")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", id);

  return data;
}

/**
 * Fetch popup notices (for main page display)
 */
export async function fetchPopupNotices(): Promise<Notice[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notices")
    .select(`
      *,
      profiles:author_id (
        nickname,
        avatar_url
      )
    `)
    .eq("is_active", true)
    .eq("is_popup", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching popup notices:", error);
    return [];
  }

  return data || [];
}

/**
 * Get category badge color
 */
export function getCategoryColor(category: NoticeCategory): string {
  switch (category) {
    case "SYSTEM":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "EVENT":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "GENERAL":
    default:
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  }
}

/**
 * Get category label
 */
export function getCategoryLabel(category: NoticeCategory): string {
  switch (category) {
    case "SYSTEM":
      return "점검/안내";
    case "EVENT":
      return "이벤트";
    case "GENERAL":
    default:
      return "일반";
  }
}

/**
 * Log notice view (read)
 * - 1 user x 1 notice = 1 row
 * - already viewed notice will be ignored
 */
export async function logNoticeView(noticeId: string): Promise<void> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // 로그인 안 했으면 기록 안 함
  if (authError || !user) return;

  // upsert로 중복 방지
  await supabase
    .from("notice_view_logs")
    .upsert(
      {
        notice_id: noticeId,
        user_id: user.id,
        viewed_at: new Date().toISOString(),
      },
      {
        onConflict: "notice_id,user_id",
        ignoreDuplicates: true,
      }
    );
}

/**
 * Get count of unread notices for current user
 */
export async function fetchUnreadNoticeCount(): Promise<number> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return 0;

  // 1️⃣ 전체 활성 공지 ID
  const { data: notices, error: noticeError } = await supabase
    .from("notices")
    .select("id")
    .eq("is_active", true);

  if (noticeError || !notices) {
    console.error("Error fetching notices:", noticeError);
    return 0;
  }

  // 2️⃣ 내가 읽은 공지 ID
  const { data: readLogs, error: readError } = await supabase
    .from("notice_view_logs")
    .select("notice_id")
    .eq("user_id", user.id);

  if (readError || !readLogs) {
    console.error("Error fetching notice view logs:", readError);
    return notices.length;
  }

  // 3️⃣ Set 으로 필터링
  const readSet = new Set(readLogs.map((v) => v.notice_id));

  const unreadCount = notices.filter(
    (notice) => !readSet.has(notice.id)
  ).length;

  return unreadCount;
}