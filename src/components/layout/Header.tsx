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

export function Header() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_OUT') {
        setUser(null);
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

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4">
        {/* Logo */}
        <div className="mr-8 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block text-xl tracking-tight">
              Invest<span className="text-primary">Comm</span>
            </span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/tournament" className="transition-colors hover:text-foreground/80 text-foreground/60">
              토너먼트
            </Link>
            {/* <Link href="/mypage" className="transition-colors hover:text-foreground/80 text-foreground/60">
              마이페이지
            </Link> */}
            <Link href="/notices" className="transition-colors hover:text-foreground/80 text-foreground/60">
              공지사항
            </Link>
            <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
              커뮤니티
            </Link>
          </nav>
        </div>

        {/* Mobile Menu */}
        <Button variant="ghost" className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>

        {/* Search */}
        <div className="flex flex-1 items-center space-x-2 mr-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="종목 검색... (Ctrl+K)"
              className="w-full bg-secondary pl-9 md:w-[300px] lg:w-[400px] focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
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
