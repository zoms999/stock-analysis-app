
import { login, signup } from './actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            InvestComm 시작하기
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            프리미엄 차트 분석 커뮤니티에 오신 것을 환영합니다.
          </p>
        </div>

        <form className="mt-8 space-y-6">
            <div className="space-y-4">
                <div>
                    <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">이메일</label>
                    <Input id="email" name="email" type="email" required className="mt-1" placeholder="name@example.com"/>
                </div>
                <div>
                    <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">비밀번호</label>
                    <Input id="password" name="password" type="password" required className="mt-1" placeholder="••••••••"/>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <Button formAction={login} className="w-full" variant="premium">
                    로그인
                </Button>
                <Button formAction={signup} className="w-full" variant="outline">
                    회원가입
                </Button>
            </div>
            
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                        또는
                    </span>
                </div>
            </div>
            
             <Button className="w-full bg-[#EA4335] text-white hover:bg-[#D93025]" variant="ghost">
                Google로 계속하기 (준비중)
             </Button>
        </form>
      </div>
    </div>
  )
}
