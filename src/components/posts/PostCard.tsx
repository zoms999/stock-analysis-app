"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Eye, TrendingUp } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/time";
import type { Post } from "@/lib/api/posts";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const profileData = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const nickname = profileData?.nickname || "익명";
  const avatarUrl = profileData?.avatar_url;

  return (
    <Link href={`/posts/${post.id}`}>
      <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-secondary/10 overflow-hidden">
          {post.chart_image_url ? (
            <img
              src={post.chart_image_url}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <TrendingUp className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Ticker Badge */}
          {post.ticker_symbol && (
            <div className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              {post.ticker_symbol}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-bold text-lg line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>

          {/* Metadata */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={avatarUrl} alt={nickname} />
                <AvatarFallback className="text-xs">
                  {nickname.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{nickname}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{post.view_count}</span>
              </div>
              <span>{formatRelativeTime(post.created_at)}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
