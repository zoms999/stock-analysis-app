import { Header } from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-border py-6 md:px-8 md:py-0 bg-card/50">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              © 2024 InvestComm. 모든 권리 보유.
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="cursor-pointer hover:text-primary">이용약관</span>
                <span className="cursor-pointer hover:text-primary">개인정보처리방침</span>
            </div>
        </div>
      </footer>
    </div>
  );
}
