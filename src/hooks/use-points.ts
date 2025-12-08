"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY_POINTS = "chart_platform_points";
const STORAGE_KEY_UNLOCKED = "chart_platform_unlocked_posts";
const INITIAL_POINTS = 1000;

export function usePoints() {
  const [points, setPoints] = useState(INITIAL_POINTS);
  const [unlockedPosts, setUnlockedPosts] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const storedPoints = localStorage.getItem(STORAGE_KEY_POINTS);
    const storedUnlocked = localStorage.getItem(STORAGE_KEY_UNLOCKED);

    if (storedPoints) {
      setPoints(parseInt(storedPoints, 10));
    } else {
        localStorage.setItem(STORAGE_KEY_POINTS, INITIAL_POINTS.toString());
    }

    if (storedUnlocked) {
      setUnlockedPosts(JSON.parse(storedUnlocked));
    }
    
    setIsLoaded(true);
  }, []);

  const deductPoints = (amount: number) => {
    if (points >= amount) {
      const newBalance = points - amount;
      setPoints(newBalance);
      localStorage.setItem(STORAGE_KEY_POINTS, newBalance.toString());
      return true;
    }
    return false;
  };

  const addPoints = (amount: number) => {
      const newBalance = points + amount;
      setPoints(newBalance);
      localStorage.setItem(STORAGE_KEY_POINTS, newBalance.toString());
  };

  const unlockPost = (postId: number) => {
    if (!unlockedPosts.includes(postId)) {
        const newUnlocked = [...unlockedPosts, postId];
        setUnlockedPosts(newUnlocked);
        localStorage.setItem(STORAGE_KEY_UNLOCKED, JSON.stringify(newUnlocked));
    }
  };

  const hasUnlocked = (postId: number) => {
      return unlockedPosts.includes(postId);
  };

  return {
    points,
    deductPoints,
    addPoints,
    unlockPost,
    hasUnlocked,
    isLoaded
  };
}
