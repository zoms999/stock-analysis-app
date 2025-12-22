export default function AdminPlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <p className="text-gray-500">이 페이지는 아직 준비중입니다.</p>
        <p className="mt-2 text-sm text-gray-400">기능 구현이 필요합니다.</p>
      </div>
    </div>
  )
}
