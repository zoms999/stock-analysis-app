import Link from 'next/link';
import { Tournament } from '@/types/tournament';
import { format } from 'date-fns';

interface TournamentItemProps {
  tournament: Tournament;
}

export default function TournamentItem({ tournament }: TournamentItemProps) {
  const statusColors = {
    UPCOMING: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    OPEN: 'bg-green-500/10 text-green-500 border-green-500/20',
    LOCKED: 'bg-red-500/10 text-red-500 border-red-500/20',
    SETTLED: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  };

  const statusLabels = {
    UPCOMING: '진행 예정',
    OPEN: '진행 중',
    LOCKED: '마감 임박', // or '진행 중' depending on logic, usually LOCKED implies no more entries but not settled
    SETTLED: '종료됨',
  };

  const typeLabel = tournament.event_type === 'PREDICTION' ? '가격 예측' : '소수점 로또';

  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <div className="group relative overflow-hidden rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1">
        
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex gap-2">
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border tracking-wider ${statusColors[tournament.status] || statusColors.SETTLED}`}>
                {statusLabels[tournament.status] || tournament.status}
              </span>
              <span className="px-2.5 py-1 rounded-md text-[10px] font-bold border bg-secondary text-secondary-foreground border-border">
                {typeLabel}
              </span>
            </div>
            <span className="text-muted-foreground text-xs font-mono">
              {format(new Date(tournament.target_date), 'MM월 dd일 HH:mm')}
            </span>
          </div>
          
          <h3 className="text-lg font-bold text-card-foreground mb-2 group-hover:text-primary transition-colors line-clamp-1">
            {tournament.title}
          </h3>
          
          <p className="text-muted-foreground text-sm mb-6 line-clamp-2 h-10">
            {tournament.description || '상세 설명이 없습니다.'}
          </p>
          
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-yellow-500 font-bold text-sm tracking-wide">{tournament.prize_pool || '미정'}</span>
            </div>
            
            <span className="text-primary text-sm font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              참가하기 
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
