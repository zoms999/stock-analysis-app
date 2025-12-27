import { Card, CardContent } from "@/components/ui/card"
import { AdminPageHeader } from "@/components/admin/AdminPageHeader"

export default function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <AdminPageHeader title={title} description="이 페이지는 아직 준비중입니다." />
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">기능 구현이 필요합니다.</p>
        </CardContent>
      </Card>
    </div>
  )
}
