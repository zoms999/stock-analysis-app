"use client";

import { Search, Globe, Bell, Menu, User, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Clock } from "./Clock";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlobalSearch } from "@/components/common/GlobalSearch";

export function Header() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Check Auth & Subscribe to changes
    const checkUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          // refresh 토큰이 깨진 상태(예: 쿠키/스토리지 정리 후 남은 세션)면 로컬 세션을 정리
          const anyErr = error as any;
          if (anyErr?.code === "refresh_token_not_found" || String(anyErr?.message || "").includes("Refresh Token")) {
            await supabase.auth.signOut({ scope: "local" as any });
            setUser(null);
            setUserLevel(1);
            setIsAdmin(false);
            setIsPartner(false);
            return;
          }
        }
        setUser(user);
      } catch (error: any) {
        // getUser() 호출 자체가 throw되는 케이스 방어
        if (error?.code === "refresh_token_not_found" || String(error?.message || "").includes("Refresh Token")) {
          try {
            await supabase.auth.signOut({ scope: "local" as any });
          } catch {
            // ignore
          }
          setUser(null);
          setUserLevel(1);
          setIsAdmin(false);
          setIsPartner(false);
          return;
        }
        console.error("Failed to check user", error);
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_OUT') {
        setUser(null);
        setUserLevel(1);
        setIsAdmin(false);
        setIsPartner(false);
        router.refresh();
      } else if (_event === 'SIGNED_IN') {
        router.refresh();
      }
    });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      subscription.unsubscribe();
    };
  }, [router, pathname]);

  // ✅ [Safe Implementation] Separate effect for fetching user level
  // Runs only after `user` is set, with a small delay to prioritize main content loading
  useEffect(() => {
    if (!user) return;

    const fetchLevel = async () => {
        const supabase = createClient();
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('user_level,is_admin,is_partner')
                .eq('id', user.id)
                .single();

            if (data && !error) {
                setUserLevel(data.user_level ?? 1);
                setIsAdmin((data as any).is_admin === true || (data.user_level ?? 1) >= 99);
                setIsPartner((data as any).is_partner === true);
            }
        } catch (e) {
            console.error("Failed to fetch user level", e);
        }
    };

    // Delay fetch to avoid competing with critical page resources (Chart)
    const timer = setTimeout(() => {
        fetchLevel();
    }, 1000); 

    return () => clearTimeout(timer);
  }, [user]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setUserLevel(1);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4">
        {/* Logo */}
        <div className="mr-8 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2 cursor-pointer">
            <span className="hidden font-bold sm:inline-block text-xl tracking-tight">
              Invest<span className="text-primary">Comm</span>
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/tournaments" className="transition-colors hover:text-foreground/80 text-foreground/60 cursor-pointer">
              토너먼트
            </Link>
            {/* <Link href="/mypage" className="transition-colors hover:text-foreground/80 text-foreground/60">
              마이페이지
            </Link> */}
            <Link href="/posts" className="transition-colors hover:text-foreground/80 text-foreground/60 cursor-pointer">
              차트 게시판
            </Link>
            <Link href="/notices" className="transition-colors hover:text-foreground/80 text-foreground/60 cursor-pointer">
              공지사항
            </Link>
            <Link href="/subscription" className="transition-colors hover:text-foreground/80 text-foreground/60 cursor-pointer">
              구독하기
            </Link>
            {isPartner && (
               <Link href="/partner/dashboard" className="transition-colors text-purple-600 hover:text-purple-800 font-bold cursor-pointer">
                파트너
              </Link>
            )}
            {isAdmin && (
               <Link href="/admin" className="transition-colors text-red-500 hover:text-red-700 font-bold cursor-pointer">
                관리자
              </Link>
            )}
            {/* <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
              커뮤니티
            </Link> */}
          </nav>
        </div>

        {/* Mobile Menu */}
        <Button
          variant="ghost"
          className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="메뉴 열기"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>

        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>메뉴</DialogTitle>
            </DialogHeader>

            <nav className="grid gap-2">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                홈
              </Link>
              <Link
                href="/tournaments"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                토너먼트
              </Link>
              <Link
                href="/posts"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                차트 게시판
              </Link>
              <Link
                href="/notices"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                공지사항
              </Link>
              <Link
                href="/subscription"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                구독하기
              </Link>
              {isPartner && (
                <Link
                  href="/partner/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-bold text-purple-600 hover:bg-purple-50"
                >
                  파트너
                </Link>
              )}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-bold text-destructive hover:bg-destructive/10"
                >
                  관리자
                </Link>
              )}

              <div className="pt-2 border-t border-border mt-2" />

              <Link href={user ? "/analyze" : "/login"} onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full justify-between" variant="outline">
                  <span>차트 분석하기</span>
                  <LogOut className="h-4 w-4 rotate-90" />
                </Button>
              </Link>
            </nav>
          </DialogContent>
        </Dialog>
        
        <div className="flex flex-1 md:hidden">
             {/* Mobile specific spacing or search if needed, but keeping simple for now */}
        </div>

        <div className="flex items-center space-x-4 ml-auto">
          <Link href={user ? "/analyze" : "/login"}>
            <Button variant="outline" className="hidden md:flex items-center gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors">
              <LogOut className="h-4 w-4 rotate-90" />
              <span className="text-primary font-bold">차트 분석하기</span>
            </Button>
          </Link>

          <GlobalSearch />

          <Clock />

          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground" 
            title="테마 변경"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && (theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            ))}
          </Button>

          <Button variant="ghost" size="icon" className="text-muted-foreground" title="언어 변경">
            <Globe className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" className="text-muted-foreground" title="알림">
            <Bell className="h-5 w-5" />
          </Button>

          {/* Login / User Placeholder */}
          {user ? (
            <div className="flex items-center space-x-2">
              <Link href="/mypage" className="cursor-pointer">
                <div className="hidden sm:flex items-center gap-2 mr-2">
                   <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user.email} />
                    <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-muted-foreground">
                    {user.user_metadata?.nickname || user.email?.split('@')[0]}님
                  </span>
                </div>
              </Link>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="로그아웃">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button variant="premium" size="sm" className="hidden sm:inline-flex font-bold">
                로그인
              </Button>
            </Link>
          )}

          <Link href={user ? "/mypage" : "/login"} className="sm:hidden">
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
