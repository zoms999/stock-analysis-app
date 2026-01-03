"use client"

import * as React from "react"
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
  Search,
  FileText,
  Trophy,
  LayoutDashboard
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">검색...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="검색어를 입력하세요..." />
        <CommandList>
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          <CommandGroup heading="바로가기">
            <CommandItem onSelect={() => runCommand(() => router.push('/'))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>홈</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/tournaments'))}>
              <Trophy className="mr-2 h-4 w-4" />
              <span>토너먼트</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/posts'))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>차트 게시판</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/analyze'))}>
              <Calculator className="mr-2 h-4 w-4" />
              <span>차트 분석</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="설정">
            <CommandItem onSelect={() => runCommand(() => router.push('/mypage'))}>
              <User className="mr-2 h-4 w-4" />
              <span>마이페이지</span>
              <CommandShortcut>⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/subscription'))}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>구독 관리</span>
              <CommandShortcut>⌘B</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>설정</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
