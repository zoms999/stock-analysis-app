export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">관리자 현황을 한눈에 확인합니다.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* KPI Cards */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium">총 회원수</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium">오늘 매출</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium">진행중 토너먼트</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-gray-500 text-sm font-medium">오늘 방문자</h3>
          <p className="text-2xl font-bold text-gray-900 mt-2">-</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity / To-Do */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">할 일 (Pending Actions)</h2>
          <div className="space-y-4">
            <p className="text-gray-500 text-sm">처리할 정산 요청이나 신고 내역이 없습니다.</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-4">최근 가입 회원</h2>
          <div className="space-y-4">
             <p className="text-gray-500 text-sm">데이터 조회 기능 준비중...</p>
          </div>
        </div>
      </div>
    </div>
  )
}
