-- Create forum_categories table
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT NOT NULL DEFAULT '#000000',
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create forum_user_profiles table
CREATE TABLE IF NOT EXISTS public.forum_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create forum_user_approvals table
CREATE TABLE IF NOT EXISTS public.forum_user_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  auto_approved BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  request_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create forum_posts table
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.forum_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'link', 'product')),
  link_url TEXT,
  linked_listing_id UUID,
  images TEXT[] DEFAULT '{}',
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_removed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create forum_comments table
CREATE TABLE IF NOT EXISTS public.forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  upvote_count INTEGER NOT NULL DEFAULT 0,
  downvote_count INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  is_removed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create forum_votes table
CREATE TABLE IF NOT EXISTS public.forum_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  votable_type TEXT NOT NULL CHECK (votable_type IN ('post', 'comment')),
  votable_id UUID NOT NULL,
  vote SMALLINT NOT NULL CHECK (vote IN (1, -1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, votable_type, votable_id)
);

-- Create forum_notifications table
CREATE TABLE IF NOT EXISTS public.forum_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_reputation view/table
CREATE TABLE IF NOT EXISTS public.user_reputation (
  user_id UUID PRIMARY KEY REFERENCES public.forum_user_profiles(id) ON DELETE CASCADE,
  post_karma INTEGER NOT NULL DEFAULT 0,
  comment_karma INTEGER NOT NULL DEFAULT 0,
  total_karma INTEGER NOT NULL DEFAULT 0,
  posts_created INTEGER NOT NULL DEFAULT 0,
  comments_created INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_user_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum_categories (public read)
CREATE POLICY "Anyone can view categories" ON public.forum_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.forum_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- RLS Policies for forum_user_profiles
CREATE POLICY "Anyone can view profiles" ON public.forum_user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create own profile" ON public.forum_user_profiles FOR INSERT WITH CHECK (auth.uid() = customer_user_id);
CREATE POLICY "Users can update own profile" ON public.forum_user_profiles FOR UPDATE USING (auth.uid() = customer_user_id);

-- RLS Policies for forum_user_approvals
CREATE POLICY "Users can view own approval" ON public.forum_user_approvals FOR SELECT USING (auth.uid() = customer_user_id);
CREATE POLICY "Users can create own approval request" ON public.forum_user_approvals FOR INSERT WITH CHECK (auth.uid() = customer_user_id);
CREATE POLICY "Admins can manage approvals" ON public.forum_user_approvals FOR ALL USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- RLS Policies for forum_posts
CREATE POLICY "Anyone can view non-removed posts" ON public.forum_posts FOR SELECT USING (is_removed = false OR auth.uid() IS NOT NULL);
CREATE POLICY "Approved users can create posts" ON public.forum_posts FOR INSERT WITH CHECK (
  author_id IN (SELECT id FROM forum_user_profiles WHERE customer_user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Authors can update own posts" ON public.forum_posts FOR UPDATE USING (
  author_id IN (SELECT id FROM forum_user_profiles WHERE customer_user_id = auth.uid())
);
CREATE POLICY "Authors can delete own posts" ON public.forum_posts FOR DELETE USING (
  author_id IN (SELECT id FROM forum_user_profiles WHERE customer_user_id = auth.uid())
);

-- RLS Policies for forum_comments
CREATE POLICY "Anyone can view non-removed comments" ON public.forum_comments FOR SELECT USING (is_removed = false OR auth.uid() IS NOT NULL);
CREATE POLICY "Approved users can create comments" ON public.forum_comments FOR INSERT WITH CHECK (
  author_id IN (SELECT id FROM forum_user_profiles WHERE customer_user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Authors can update own comments" ON public.forum_comments FOR UPDATE USING (
  author_id IN (SELECT id FROM forum_user_profiles WHERE customer_user_id = auth.uid())
);
CREATE POLICY "Authors can delete own comments" ON public.forum_comments FOR DELETE USING (
  author_id IN (SELECT id FROM forum_user_profiles WHERE customer_user_id = auth.uid())
);

-- RLS Policies for forum_votes
CREATE POLICY "Users can view own votes" ON public.forum_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create votes" ON public.forum_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON public.forum_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.forum_votes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for forum_notifications
CREATE POLICY "Users can view own notifications" ON public.forum_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.forum_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.forum_notifications FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for user_reputation
CREATE POLICY "Anyone can view reputation" ON public.user_reputation FOR SELECT USING (true);
CREATE POLICY "System can manage reputation" ON public.user_reputation FOR ALL USING (true);

-- Create indexes
CREATE INDEX idx_forum_posts_category ON public.forum_posts(category_id);
CREATE INDEX idx_forum_posts_author ON public.forum_posts(author_id);
CREATE INDEX idx_forum_posts_created ON public.forum_posts(created_at DESC);
CREATE INDEX idx_forum_comments_post ON public.forum_comments(post_id);
CREATE INDEX idx_forum_comments_parent ON public.forum_comments(parent_comment_id);
CREATE INDEX idx_forum_votes_user ON public.forum_votes(user_id, votable_type, votable_id);
CREATE INDEX idx_forum_notifications_user ON public.forum_notifications(user_id, read);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_forum_user_profiles_updated_at BEFORE UPDATE ON public.forum_user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forum_user_approvals_updated_at BEFORE UPDATE ON public.forum_user_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forum_comments_updated_at BEFORE UPDATE ON public.forum_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();