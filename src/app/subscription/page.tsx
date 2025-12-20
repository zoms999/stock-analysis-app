import { SubscriptionPlans } from "@/components/subscription/SubscriptionPlans";

export default function SubscriptionPage() {
  return (
    <div className="container mx-auto py-10 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-4">멤버십 플랜</h1>
        <p className="text-muted-foreground text-lg">
          더 많은 분석 정보와 혜택을 누려보세요.
        </p>
      </div>
      
      <SubscriptionPlans />
    </div>
  );
}
