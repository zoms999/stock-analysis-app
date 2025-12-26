import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white min-h-screen">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>
        <nav className="p-4 space-y-2">
          <Link href="/admin/dashboard" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            대시보드
          </Link>
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase">
            회원 및 파트너
          </div>
          <Link href="/admin/users" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            회원 관리
          </Link>
          <Link href="/admin/partners" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            파트너 관리
          </Link>
          <Link href="/admin/settlements" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            정산 관리
          </Link>
          <Link href="/admin/statistics" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            통계 대시보드
          </Link>
          
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase">
            운영 관리
          </div>
          <Link href="/admin/tournaments" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            토너먼트
          </Link>
          <Link href="/admin/posts" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            게시글 관리
          </Link>
          <Link href="/admin/notices" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            공지사항
          </Link>

          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase">
            설정
          </div>
          <Link href="/admin/settings" className="block py-2.5 px-4 rounded hover:bg-gray-800">
            설정
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
