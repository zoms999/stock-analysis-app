export type SortOption =
  | "all"
  | "accuracy"
  | "recent_accuracy"
  | "most_analyzed"
  | "latest"
  | "completed"
  | "daily_accuracy"
  | "accuracy_5day"
  | "accuracy_10day";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "accuracy", label: "정확도순" },
  { value: "recent_accuracy", label: "최근정확도순" },
  { value: "most_analyzed", label: "많이분석한종목순" },
  { value: "latest", label: "최신분석순" },
  { value: "completed", label: "분석완료순" },
  { value: "daily_accuracy", label: "정확도 일일순" },
  { value: "accuracy_5day", label: "정확도 5일순" },
  { value: "accuracy_10day", label: "정확도 10일순" },
];











