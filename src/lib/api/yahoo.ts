export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export async function fetchYahooCandles(symbol: string = "AAPL", interval: string = "1d"): Promise<CandleData[]> {
  try {
    // Use proxy route
    const url = `/api/yahoo/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Yahoo API Error (${response.status}):`, errorData);

      // Throw error with user-friendly message if available
      const errorMessage = errorData.error || `Yahoo API Error: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      console.error("Yahoo API returned invalid format:", data);
      throw new Error("잘못된 데이터 형식입니다.");
    }

    return data;

  } catch (error) {
    console.error("Failed to fetch yahoo candles:", error);
    // Re-throw to let the component handle it
    throw error;
  }
}
