"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home } from "lucide-react"

type NavItem = { href: string; label: string }
type NavSection = { title: string; items: NavItem[] }

const sections: NavSection[] = [
  { title: "대시보드", items: [{ href: "/admin/dashboard", label: "대시보드" }] },
  {
    title: "회원 및 파트너",
    items: [
      { href: "/admin/users", label: "회원 관리" },
      { href: "/admin/partners", label: "파트너 관리" },
      { href: "/admin/settlements", label: "정산 관리" },
      { href: "/admin/statistics", label: "통계 대시보드" },
    ],
  },
  {
    title: "운영 관리",
    items: [
      { href: "/admin/tournaments", label: "토너먼트" },
      { href: "/admin/posts", label: "게시글 관리" },
      { href: "/admin/notices", label: "공지사항" },
    ],
  },
  { title: "설정", items: [{ href: "/admin/settings", label: "설정" }] },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card/40">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">Admin Panel</div>
            <div className="text-xs text-muted-foreground mt-1">관리자 페이지</div>
          </div>

          <Link
            href="/"
            aria-label="프론트 메인으로 이동"
            className={cn(
              "shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-50",
              "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
              "h-9 rounded-md px-3"
            )}
          >
            <Home className="h-4 w-4 mr-1" />
            메인
          </Link>
        </div>
      </div>

      <nav className="p-3 space-y-2">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="px-3 pt-3 pb-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin/dashboard" && pathname?.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}


