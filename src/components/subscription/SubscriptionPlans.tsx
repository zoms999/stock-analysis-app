"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

// TODO: Replace these placeholders with real IDs from your Database (plans table) and Stripe Dashboard (Price IDs).
const PLANS = [
    {
        name: "Basic Member",
        price: "무료",
        desc: "기본 회원",
        priceId: null, // Free
        planId: null, // Free plan UUID
        features: [
            "하루 열람 3회",
            "하루 글쓰기 5회",
            "콘텐츠 레벨 5등급까지"
        ],
        buttonText: "현재 이용 중",
        highlight: false
    },
    {
        name: "Light User",
        price: "9,900원/월",
        desc: "가볍게 매일 더 많이",
        costRaw: 9900,
        priceId: "price_1SgamsJJrcmsp83Oc4UAJicn", 
        planId: "2",
        features: [
            "하루 열람 6회",
            "하루 글쓰기 10회",
            "콘텐츠 레벨 6등급까지",
            "+ 보너스 2,000P"
        ],
        buttonText: "시작하기",
        highlight: false
    },
    {
        name: "Standard",
        price: "19,900원/월",
        desc: "분석/열람을 충분히",
        costRaw: 19900,
        priceId: "price_1SgaojJJrcmsp83OGGqv56aT",
        planId: "3",
        features: [
            "하루 열람 12회",
            "하루 글쓰기 20회",
            "콘텐츠 레벨 7등급까지",
            "+ 보너스 5,000P"
        ],
        buttonText: "시작하기",
        highlight: true
    },
    {
        name: "Premium",
        price: "39,900원/월",
        desc: "본격적으로 활용",
        costRaw: 39900,
        priceId: "price_1SgaozJJrcmsp83Oe0INYKiY",
        planId: "4",
        features: [
            "하루 열람 24회",
            "하루 글쓰기 30회",
            "콘텐츠 레벨 8등급까지",
            "+ 보너스 12,000P"
        ],
        buttonText: "시작하기",
        highlight: false
    },
     {
        name: "VIP",
        price: "79,900원/월",
        desc: "무제한 + 모든 레벨",
        costRaw: 79900,
        priceId: "price_1SgapLJJrcmsp83OatlHn1vg",
        planId: "5",
        features: [
            "하루 열람 무제한",
            "하루 글쓰기 무제한",
            "콘텐츠 레벨 10등급까지",
            "+ 보너스 30,000P"
        ],
        buttonText: "시작하기",
        highlight: false
    }
];

export function SubscriptionPlans() {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleSubscribe = async (plan: typeof PLANS[0]) => {
    if (!plan.priceId) return; // Free plan or invalid
    
    setLoadingId(plan.name);
    try {
        const response = await fetch('/api/stripe/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: plan.priceId,
                planId: plan.planId
            }),
        });
        
        const data = await response.json();
        
        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error("Checkout failed", data);
            alert("결제 페이지로 이동할 수 없습니다.");
        }
    } catch (error) {
        console.error("Purchase error", error);
        alert("오류가 발생했습니다.");
    } finally {
        setLoadingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {PLANS.map((plan) => (
        <Card key={plan.name} className={`flex flex-col ${plan.highlight ? 'border-primary shadow-lg scale-105' : ''}`}>
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardDescription>{plan.desc}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="text-2xl font-bold mb-4">{plan.price}</div>
            <ul className="space-y-2">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button 
                className="w-full" 
                variant={plan.highlight ? "default" : "outline"}
                disabled={!plan.priceId || loadingId === plan.name}
                onClick={() => handleSubscribe(plan)}
            >
              {loadingId === plan.name ? <Loader2 className="h-4 w-4 animate-spin" /> : plan.buttonText}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
