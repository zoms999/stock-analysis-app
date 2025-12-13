"use client";

import { useEffect, useState } from "react";
import { PostCard } from "@/components/posts/PostCard";
import { fetchPosts, type Post } from "@/lib/api/posts";
import { Loader2 } from "lucide-react";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const data = await fetchPosts(20, 0);
        setPosts(data);
      } catch (error) {
        console.error("Failed to load posts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-12 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">차트 분석 게시판</h1>
        <p className="text-muted-foreground">
          커뮤니티 회원들의 차트 분석을 확인해보세요
        </p>
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg">
            아직 게시글이 없습니다.
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            첫 번째 차트 분석을 작성해보세요!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
