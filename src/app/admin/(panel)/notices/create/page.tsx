import NoticeForm from '@/components/admin/NoticeForm'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

export default function AdminNoticeCreatePage() {
  return (
    <div>
      <AdminPageHeader title="새 공지사항 작성" />
      <NoticeForm />
    </div>
  )
}







