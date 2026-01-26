-- ============================================================================
-- FORUM COMMUNITY SYSTEM
-- ============================================================================
-- Reddit-style global community forum with approval workflow
-- Multi-tenant aware but global visibility
-- ============================================================================

-- ============================================================================
-- FORUM CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  color VARCHAR(7) DEFAULT '#10b981',
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO public.forum_categories (name, slug, description, icon, color, display_order) VALUES
('General Discussion', 'general', 'General cannabis discussions', '💬', '#10b981', 1),
('Product Reviews', 'reviews', 'Share your product experiences', '⭐', '#f59e0b', 2),
('Growing Tips', 'growing', 'Cultivation advice and tips', '🌱', '#84cc16', 3),
('Strain Discussion', 'strains', 'Talk about your favorite strains', '🌿', '#8b5cf6', 4),
('News & Updates', 'news', 'Industry news and updates', '📰', '#06b6d4', 5),
('Questions', 'questions', 'Ask the community', '❓', '#ef4444', 6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- FORUM USER PROFILES
-- ============================================================================
-- Forum-specific user profiles with usernames
CREATE TABLE IF NOT EXISTS public.forum_user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  
  -- Forum Identity
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  bio TEXT,
  avatar_url TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(customer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_forum_profiles_customer_user ON public.forum_user_profiles(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_forum_profiles_username ON public.forum_user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_forum_profiles_tenant ON public.forum_user_profiles(tenant_id);

-- ============================================================================
-- FORUM USER APPROVALS
-- ============================================================================
-- Approval workflow for new forum users
CREATE TABLE IF NOT EXISTS public.forum_user_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES public.customer_users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  
  -- Approval Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  auto_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.super_admin_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Request Info
  request_message TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_approvals_customer_user ON public.forum_user_approvals(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_forum_approvals_status ON public.forum_user_approvals(status);

-- ============================================================================
-- FORUM POSTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.forum_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  
  title VARCHAR(300) NOT NULL,
  content TEXT,
  content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'link', 'product')),
  
  -- Link posts
  link_url TEXT,
  
  -- Product posts
  linked_listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  
  -- Media
  images TEXT[] DEFAULT '{}',
  
  -- Engagement
  upvote_count INTEGER DEFAULT 0,
  downvote_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  
  -- Moderation
  is_pinned BOOLEAN DEFAULT false,
  is_removed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_posts_category ON public.forum_posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_hot ON public.forum_posts((upvote_count - downvote_count) DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_search ON public.forum_posts USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_posts_tenant ON public.forum_posts(tenant_id);

-- ============================================================================
-- FORUM COMMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forum_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE SET NULL,
  
  content TEXT NOT NULL,
  
  upvote_count INTEGER DEFAULT 0,
  downvote_count INTEGER DEFAULT 0,
  
  depth INTEGER DEFAULT 0 CHECK (depth >= 0 AND depth <= 3),
  
  is_removed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON public.forum_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.forum_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON public.forum_comments(author_id);

-- ============================================================================
-- FORUM VOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forum_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE CASCADE,
  votable_type VARCHAR(20) NOT NULL CHECK (votable_type IN ('post', 'comment')),
  votable_id UUID NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, votable_type, votable_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_votable ON public.forum_votes(votable_type, votable_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.forum_votes(user_id);

-- ============================================================================
-- USER REPUTATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_reputation (
  user_id UUID PRIMARY KEY REFERENCES public.forum_user_profiles(id) ON DELETE CASCADE,
  post_karma INTEGER DEFAULT 0,
  comment_karma INTEGER DEFAULT 0,
  total_karma INTEGER GENERATED ALWAYS AS (post_karma + comment_karma) STORED,
  posts_created INTEGER DEFAULT 0,
  comments_created INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FORUM NOTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forum_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  post_id UUID REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.forum_user_profiles(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  action_url TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.forum_notifications(user_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.forum_notifications(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_user_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_notifications ENABLE ROW LEVEL SECURITY;

-- Categories: Anyone can view (authenticated or not)
CREATE POLICY "view_categories" ON public.forum_categories FOR SELECT
  TO public
  USING (true);

-- User Profiles: Anyone can view active profiles
CREATE POLICY "view_profiles" ON public.forum_user_profiles FOR SELECT
  TO public
  USING (status = 'active');

-- User Profiles: Users can update their own
CREATE POLICY "update_own_profile" ON public.forum_user_profiles FOR UPDATE
  TO authenticated
  USING (
    customer_user_id = auth.uid()
  );

-- Approvals: Users can view their own
CREATE POLICY "view_own_approval" ON public.forum_user_approvals FOR SELECT
  TO authenticated
  USING (
    customer_user_id = auth.uid()
  );

-- Approvals: Users can create their own
CREATE POLICY "create_own_approval" ON public.forum_user_approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_user_id = auth.uid()
  );

-- Posts: Anyone can view non-removed posts (read-only access)
CREATE POLICY "view_posts" ON public.forum_posts FOR SELECT
  TO public
  USING (is_removed = false);

-- Posts: Approved users can create
CREATE POLICY "create_posts" ON public.forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      JOIN public.forum_user_approvals fua ON fua.customer_user_id = fup.customer_user_id
      WHERE fup.id = forum_posts.author_id
      AND fup.customer_user_id = auth.uid()
      AND fua.status = 'approved'
    )
  );

-- Posts: Authors can update their own
CREATE POLICY "update_own_posts" ON public.forum_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_posts.author_id
      AND fup.customer_user_id = auth.uid()
    )
  );

-- Posts: Authors can delete their own
CREATE POLICY "delete_own_posts" ON public.forum_posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_posts.author_id
      AND fup.customer_user_id = auth.uid()
    )
  );

-- Comments: Anyone can view non-removed (read-only access)
CREATE POLICY "view_comments" ON public.forum_comments FOR SELECT
  TO public
  USING (is_removed = false);

-- Comments: Approved users can create
CREATE POLICY "create_comments" ON public.forum_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      JOIN public.forum_user_approvals fua ON fua.customer_user_id = fup.customer_user_id
      WHERE fup.id = forum_comments.author_id
      AND fup.customer_user_id = auth.uid()
      AND fua.status = 'approved'
    )
  );

-- Comments: Authors can update their own
CREATE POLICY "update_own_comments" ON public.forum_comments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_comments.author_id
      AND fup.customer_user_id = auth.uid()
    )
  );

-- Comments: Authors can delete their own
CREATE POLICY "delete_own_comments" ON public.forum_comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_comments.author_id
      AND fup.customer_user_id = auth.uid()
    )
  );

-- Votes: Users can manage their own votes
CREATE POLICY "manage_own_votes" ON public.forum_votes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_votes.user_id
      AND fup.customer_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_votes.user_id
      AND fup.customer_user_id = auth.uid()
    )
  );

-- Reputation: Anyone can view
CREATE POLICY "view_reputation" ON public.user_reputation FOR SELECT
  TO public
  USING (true);

-- Notifications: Users can view their own
CREATE POLICY "view_own_notifications" ON public.forum_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_notifications.user_id
      AND fup.customer_user_id = auth.uid()
    )
  );

-- Notifications: Users can update their own
CREATE POLICY "update_own_notifications" ON public.forum_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forum_user_profiles fup
      WHERE fup.id = forum_notifications.user_id
      AND fup.customer_user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Update vote counts
CREATE OR REPLACE FUNCTION public.update_vote_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
  target_type VARCHAR;
BEGIN
  -- Handle both INSERT/UPDATE and DELETE
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.votable_id;
    target_type := OLD.votable_type;
  ELSE
    target_id := NEW.votable_id;
    target_type := NEW.votable_type;
  END IF;

  IF target_type = 'post' THEN
    UPDATE public.forum_posts SET
      upvote_count = (SELECT COUNT(*) FROM public.forum_votes WHERE votable_id = target_id AND votable_type = 'post' AND vote = 1),
      downvote_count = (SELECT COUNT(*) FROM public.forum_votes WHERE votable_id = target_id AND votable_type = 'post' AND vote = -1)
    WHERE id = target_id;
  ELSIF target_type = 'comment' THEN
    UPDATE public.forum_comments SET
      upvote_count = (SELECT COUNT(*) FROM public.forum_votes WHERE votable_id = target_id AND votable_type = 'comment' AND vote = 1),
      downvote_count = (SELECT COUNT(*) FROM public.forum_votes WHERE votable_id = target_id AND votable_type = 'comment' AND vote = -1)
    WHERE id = target_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_votes ON public.forum_votes;
CREATE TRIGGER trigger_update_votes
  AFTER INSERT OR UPDATE OR DELETE ON public.forum_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_vote_counts();

-- Update comment count
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS TRIGGER AS $$
DECLARE
  target_post_id UUID;
BEGIN
  -- Handle both INSERT and DELETE
  IF TG_OP = 'DELETE' THEN
    target_post_id := OLD.post_id;
  ELSE
    target_post_id := NEW.post_id;
  END IF;

  UPDATE public.forum_posts SET
    comment_count = (SELECT COUNT(*) FROM public.forum_comments WHERE post_id = target_post_id AND is_removed = false)
  WHERE id = target_post_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_comment_count ON public.forum_comments;
CREATE TRIGGER trigger_update_comment_count
  AFTER INSERT OR DELETE OR UPDATE ON public.forum_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();

-- Initialize user reputation
CREATE OR REPLACE FUNCTION public.init_user_reputation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_reputation (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_init_reputation
  AFTER INSERT ON public.forum_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.init_user_reputation();

-- Update post karma
CREATE OR REPLACE FUNCTION public.update_post_karma()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_reputation SET
    post_karma = (
      SELECT COALESCE(SUM(upvote_count - downvote_count), 0)
      FROM public.forum_posts
      WHERE author_id = NEW.author_id AND is_removed = false
    ),
    posts_created = (
      SELECT COUNT(*) FROM public.forum_posts WHERE author_id = NEW.author_id AND is_removed = false
    ),
    updated_at = NOW()
  WHERE user_id = NEW.author_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_post_karma
  AFTER INSERT OR UPDATE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_post_karma();

-- Update comment karma
CREATE OR REPLACE FUNCTION public.update_comment_karma()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_reputation SET
    comment_karma = (
      SELECT COALESCE(SUM(upvote_count - downvote_count), 0)
      FROM public.forum_comments
      WHERE author_id = NEW.author_id AND is_removed = false
    ),
    comments_created = (
      SELECT COUNT(*) FROM public.forum_comments WHERE author_id = NEW.author_id AND is_removed = false
    ),
    updated_at = NOW()
  WHERE user_id = NEW.author_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_comment_karma
  AFTER INSERT OR UPDATE ON public.forum_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_karma();

-- Update category post count
CREATE OR REPLACE FUNCTION public.update_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_categories SET
      post_count = (SELECT COUNT(*) FROM public.forum_posts WHERE category_id = NEW.category_id AND is_removed = false)
    WHERE id = NEW.category_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_categories SET
      post_count = (SELECT COUNT(*) FROM public.forum_posts WHERE category_id = OLD.category_id AND is_removed = false)
    WHERE id = OLD.category_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_category_post_count
  AFTER INSERT OR DELETE ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_category_post_count();

-- Auto-approve users with existing orders
CREATE OR REPLACE FUNCTION public.auto_approve_forum_user()
RETURNS TRIGGER AS $$
DECLARE
  has_orders BOOLEAN;
  customer_record_id UUID;
BEGIN
  -- Get the customer_id from customer_users
  SELECT customer_id INTO customer_record_id
  FROM public.customer_users
  WHERE id = NEW.customer_user_id;
  
  -- Check if user has existing orders (using customer record ID)
  IF customer_record_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.orders
      WHERE customer_id = customer_record_id
      LIMIT 1
    ) INTO has_orders;
    
    -- Also check wholesale orders
    IF NOT has_orders THEN
      SELECT EXISTS (
        SELECT 1 FROM public.wholesale_orders
        WHERE customer_id = customer_record_id
        LIMIT 1
      ) INTO has_orders;
    END IF;
  END IF;
  
  -- Auto-approve if they have orders
  IF has_orders AND NEW.status = 'pending' THEN
    NEW.status := 'approved';
    NEW.auto_approved := true;
    NEW.approved_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_approve_forum_user
  BEFORE INSERT ON public.forum_user_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_forum_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_forum_profiles_updated_at
  BEFORE UPDATE ON public.forum_user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_forum_posts_updated_at
  BEFORE UPDATE ON public.forum_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_forum_comments_updated_at
  BEFORE UPDATE ON public.forum_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_forum_approvals_updated_at
  BEFORE UPDATE ON public.forum_user_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

