-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- admin_users policies
CREATE POLICY "Users can read own admin data" ON public.admin_users
    FOR SELECT USING (auth.uid() = user_id);

-- blog_posts policies
CREATE POLICY "Public can read published posts" ON public.blog_posts
    FOR SELECT USING (is_published = true);

CREATE POLICY "Authors can read own posts" ON public.blog_posts
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Authors can upsert own posts" ON public.blog_posts
    FOR ALL USING (auth.uid() = author_id);

-- cart_item_variants policies
CREATE POLICY "Public read for variants" ON public.cart_item_variants
    FOR SELECT USING (true);

CREATE POLICY "Auth users can insert variants" ON public.cart_item_variants
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update variants" ON public.cart_item_variants
    FOR UPDATE USING (auth.role() = 'authenticated');
