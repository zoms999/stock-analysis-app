export type TournamentStatus = 'UPCOMING' | 'OPEN' | 'LOCKED' | 'SETTLED';
export type TournamentType = 'DECIMAL' | 'PREDICTION';

export interface Tournament {
  id: string;
  title: string;
  description: string | null;
  event_type: TournamentType;
  target_date: string; // Legacy support or same as end_date
  status: TournamentStatus;
  prize_pool: string | null;
  created_at: string;
  
  // ✅ New Fields
  start_date?: string;
  end_date?: string;
  stock_symbol?: string;
  prize_type?: 'POINT' | 'VOUCHER';
  ranking_rules?: string;
}

export interface PredictionSlot {
  val?: number; // For Type 1
  day?: string; // For Type 2
  price?: number; // For Type 2
}

export interface TournamentEntry {
  id: string;
  tournament_id: string;
  user_id: string;
  prediction_value: number | null;
  prediction_json: {
    slots: PredictionSlot[];
  } | null;
  is_eliminated: boolean | null;
  re_entry_count: number;
  max_re_entry: number;
  created_at: string;
}
