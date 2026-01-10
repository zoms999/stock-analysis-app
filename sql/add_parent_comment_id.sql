-- Add parent_comment_id column to post_comments table for nested comments (replies)
-- This enables reply-to-comment functionality

-- Add parent_comment_id column (nullable, references post_comments.id)
ALTER TABLE public.post_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id UUID;

-- Add foreign key constraint with CASCADE delete
-- When a parent comment is deleted, all its replies are also deleted
ALTER TABLE public.post_comments
ADD CONSTRAINT fk_parent_comment 
FOREIGN KEY (parent_comment_id) 
REFERENCES public.post_comments(id) 
ON DELETE CASCADE;

-- Add index for performance on parent_comment_id queries
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id 
ON public.post_comments(parent_comment_id);

-- Add comment to document the column
COMMENT ON COLUMN public.post_comments.parent_comment_id IS 'ID of parent comment for nested replies (NULL for top-level comments)';
