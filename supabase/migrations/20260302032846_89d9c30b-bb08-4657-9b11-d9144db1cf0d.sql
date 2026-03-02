
-- Allow anonymous/public read of active disposable menus
CREATE POLICY "Public can view active menus by token"
  ON public.disposable_menus FOR SELECT TO anon
  USING (status = 'active');

-- Allow anonymous/public read of menu products for active menus
CREATE POLICY "Public can view products for active menus"
  ON public.disposable_menu_products FOR SELECT TO anon
  USING (
    menu_id IN (
      SELECT id FROM public.disposable_menus WHERE status = 'active'
    )
  );

-- Allow anonymous/public read of wholesale inventory referenced by active menu products
CREATE POLICY "Public can view inventory for active menu products"
  ON public.wholesale_inventory FOR SELECT TO anon
  USING (
    id IN (
      SELECT product_id FROM public.disposable_menu_products
      WHERE menu_id IN (
        SELECT id FROM public.disposable_menus WHERE status = 'active'
      )
    )
  );
