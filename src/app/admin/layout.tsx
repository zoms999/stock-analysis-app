export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Admin은 사이트(다크) 테마와 독립적으로 라이트 토큰을 사용하도록 스코프를 분리합니다.
  // (globals.css의 `.light { --background ... }` 변수 오버라이드를 활용)
  return <div className="light min-h-dvh bg-background text-foreground">{children}</div>
}
