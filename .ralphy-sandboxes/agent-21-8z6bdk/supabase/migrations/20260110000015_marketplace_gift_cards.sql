-- Enhanced Gift Card System

-- 1. Gift Cards Table
CREATE TABLE IF NOT EXISTS public.marketplace_gift_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
    code text NOT NULL,
    initial_balance numeric NOT NULL CHECK (initial_balance >= 0),
    current_balance numeric NOT NULL CHECK (current_balance >= 0),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'depleted')),
    recipient_email text,
    recipient_name text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    last_used_at timestamptz,
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(store_id, code)
);

-- 2. Gift Card Ledger
CREATE TABLE IF NOT EXISTS public.marketplace_gift_card_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    gift_card_id uuid REFERENCES public.marketplace_gift_cards(id) ON DELETE CASCADE,
    store_id uuid REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
    amount numeric NOT NULL, -- Negative for debit, Positive for credit
    balance_after numeric NOT NULL,
    transaction_type text NOT NULL CHECK (transaction_type IN ('issue', 'use', 'adjustment', 'refund', 'reload')),
    order_id uuid REFERENCES public.marketplace_orders(id),
    note text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 3. Add is_gift_card to Listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS is_gift_card boolean DEFAULT false;

-- 4. Add gift_card_amount to Orders
ALTER TABLE public.marketplace_orders
ADD COLUMN IF NOT EXISTS gift_card_amount numeric DEFAULT 0;

-- 5. RLS Policies
ALTER TABLE public.marketplace_gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gift cards"
ON public.marketplace_gift_cards
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.tenant_id = (SELECT tenant_id FROM public.marketplace_stores WHERE id = marketplace_gift_cards.store_id)
    )
);

ALTER TABLE public.marketplace_gift_card_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ledger"
ON public.marketplace_gift_card_ledger
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND ur.tenant_id = (SELECT tenant_id FROM public.marketplace_stores WHERE id = marketplace_gift_card_ledger.store_id)
    )
);

-- 6. RPC: Validate Gift Card
CREATE OR REPLACE FUNCTION public.validate_marketplace_gift_card(
    p_store_id uuid,
    p_code text
)
RETURNS TABLE (
    id uuid,
    current_balance numeric,
    status text,
    is_valid boolean,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card public.marketplace_gift_cards%ROWTYPE;
BEGIN
    SELECT * INTO v_card
    FROM public.marketplace_gift_cards
    WHERE store_id = p_store_id 
    AND code = p_code;

    IF v_card.id IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, 0::numeric, 'invalid'::text, false, 'Card not found';
        RETURN;
    END IF;

    IF v_card.status = 'disabled' THEN
        RETURN QUERY SELECT v_card.id, v_card.current_balance, v_card.status, false, 'Card is disabled';
        RETURN;
    END IF;

    IF v_card.current_balance <= 0 THEN
        RETURN QUERY SELECT v_card.id, v_card.current_balance, 'depleted'::text, false, 'Card has zero balance';
        RETURN;
    END IF;

    RETURN QUERY SELECT v_card.id, v_card.current_balance, v_card.status, true, 'Valid';
END;
$$;

-- 7. RPC: Issue Gift Card (Admin)
CREATE OR REPLACE FUNCTION public.issue_marketplace_gift_card(
    p_store_id uuid,
    p_initial_balance numeric,
    p_code text DEFAULT NULL,
    p_recipient_email text DEFAULT NULL,
    p_recipient_name text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_code text;
    v_card_id uuid;
    v_tenant_id uuid;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.marketplace_stores WHERE id = p_store_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
        AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    v_new_code := COALESCE(p_code, 'GC-' || upper(substr(md5(random()::text), 1, 8)));

    INSERT INTO public.marketplace_gift_cards (
        store_id, code, initial_balance, current_balance, status, recipient_email, recipient_name, created_by
    ) VALUES (
        p_store_id, v_new_code, p_initial_balance, p_initial_balance, 'active', p_recipient_email, p_recipient_name, auth.uid()
    ) RETURNING id INTO v_card_id;

    INSERT INTO public.marketplace_gift_card_ledger (
        gift_card_id, store_id, amount, balance_after, transaction_type, note, created_by
    ) VALUES (
        v_card_id, p_store_id, p_initial_balance, p_initial_balance, 'issue', p_notes, auth.uid()
    );

    RETURN v_card_id;
END;
$$;

-- 8. OVERRIDE RPC: Create Marketplace Order with Gift Card Support
CREATE OR REPLACE FUNCTION create_marketplace_order(
  p_store_id UUID,
  p_items JSONB, 
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_delivery_address JSONB,
  p_delivery_notes TEXT,
  p_payment_method TEXT,
  p_gift_cards JSONB DEFAULT '[]'::jsonb -- Array of {code, amount}
)
RETURNS TABLE (
  success BOOLEAN,
  order_number TEXT,
  tracking_token TEXT,
  total NUMERIC,
  error_message TEXT
) AS $$
DECLARE
  v_tenant_id UUID;
  v_order_id UUID;
  v_order_num TEXT;
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_payment_method TEXT := p_payment_method;
  v_item JSONB;
  v_listing RECORD;
  v_item_total NUMERIC;
  v_tracking_token TEXT;
  
  -- Gift Card Variables
  v_gc JSONB;
  v_gc_record RECORD;
  v_gc_amount NUMERIC;
  v_total_gc_applied NUMERIC := 0;
BEGIN
  -- Get seller tenant id
  SELECT tenant_id INTO v_tenant_id FROM public.marketplace_profiles WHERE id = p_store_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Store not found'::text;
    RETURN;
  END IF;

  -- Generate Order Number
  v_order_num := 'ORD-' || FLOOR(RANDOM() * 1000000)::TEXT;
  v_tracking_token := encode(gen_random_bytes(16), 'hex');

  -- Calculate Subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_listing FROM public.marketplace_listings WHERE id = (v_item->>'product_id')::UUID;
    
    IF NOT FOUND OR v_listing.marketplace_profile_id != p_store_id THEN
      RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Invalid product in cart'::text;
      RETURN;
    END IF;

    IF v_listing.quantity_available < (v_item->>'quantity')::NUMERIC THEN
       RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Product ' || v_listing.product_name || ' out of stock'::text;
       RETURN;
    END IF;

    v_item_total := (v_item->>'price')::NUMERIC * (v_item->>'quantity')::NUMERIC;
    v_subtotal := v_subtotal + v_item_total;
  END LOOP;

  -- Calculate Total (simplified delivery fee for now since it's passed in calling code usually, but here we estimate)
  -- Wait, the previous RPC didn't take p_delivery_fee, it relied on simple defaults or client?
  -- The previous RPC calculated v_total := v_subtotal.
  -- We'll respect that pattern.
  v_total := v_subtotal;

  -- Process Gift Cards
  IF jsonb_array_length(p_gift_cards) > 0 THEN
      FOR v_gc IN SELECT * FROM jsonb_array_elements(p_gift_cards) LOOP
          -- Need code and amount to deduct
          v_gc_amount := (v_gc->>'amount')::NUMERIC;
          
          -- Find and Lock Gift Card
          SELECT * INTO v_gc_record 
          FROM public.marketplace_gift_cards 
          WHERE store_id = p_store_id 
          AND code = (v_gc->>'code')
          FOR UPDATE; -- Critical: Lock row to prevent double spend

          IF NOT FOUND THEN
             RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Gift Card ' || (v_gc->>'code') || ' not found'::text;
             RETURN;
          END IF;

          IF v_gc_record.current_balance < v_gc_amount THEN
             RETURN QUERY SELECT false, null::text, null::text, 0::numeric, 'Gift Card ' || (v_gc->>'code') || ' insufficient balance'::text;
             RETURN;
          END IF;

          -- Deduct Balance
          UPDATE public.marketplace_gift_cards
          SET current_balance = current_balance - v_gc_amount,
              last_used_at = now(),
              status = CASE WHEN (current_balance - v_gc_amount) <= 0 THEN 'depleted' ELSE 'active' END
          WHERE id = v_gc_record.id;

          v_total_gc_applied := v_total_gc_applied + v_gc_amount;
      END LOOP;
  END IF;

  -- Create Order
  INSERT INTO public.marketplace_orders (
    order_number,
    buyer_tenant_id,
    seller_tenant_id,
    seller_profile_id,
    status,
    subtotal,
    total_amount,
    gift_card_amount,
    payment_terms,
    payment_status,
    shipping_address,
    buyer_notes,
    buyer_business_name,
    tracking_token
  ) VALUES (
    v_order_num,
    v_tenant_id,
    v_tenant_id,
    p_store_id,
    'pending',
    v_subtotal,
    v_total,
    v_total_gc_applied,
    'prepaid',
    'pending',
    p_delivery_address,
    p_delivery_notes,
    p_customer_name,
    v_tracking_token
  ) RETURNING id INTO v_order_id;

  -- Insert Ledger Entries for Gift Cards
  IF jsonb_array_length(p_gift_cards) > 0 THEN
      FOR v_gc IN SELECT * FROM jsonb_array_elements(p_gift_cards) LOOP
          v_gc_amount := (v_gc->>'amount')::NUMERIC;
          
          -- Re-fetch to get updated balance
          SELECT current_balance INTO v_gc_record.current_balance 
          FROM public.marketplace_gift_cards 
          WHERE code = (v_gc->>'code') AND store_id = p_store_id;

          INSERT INTO public.marketplace_gift_card_ledger (
              gift_card_id, store_id, amount, balance_after, transaction_type, order_id, note
          ) 
          SELECT id, p_store_id, -v_gc_amount, current_balance, 'use', v_order_id, 'Redeemed on Order ' || v_order_num
          FROM public.marketplace_gift_cards
          WHERE code = (v_gc->>'code') AND store_id = p_store_id;
      END LOOP;
  END IF;

  -- Insert Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.marketplace_order_items (
      order_id, listing_id, product_name, quantity, unit_price, total_price
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'name',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'price')::NUMERIC,
      ((v_item->>'price')::NUMERIC * (v_item->>'quantity')::NUMERIC)
    );
    
    UPDATE public.marketplace_listings
    SET quantity_available = quantity_available - (v_item->>'quantity')::NUMERIC
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN QUERY SELECT true, v_order_num, v_tracking_token, v_total, null::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.validate_marketplace_gift_card TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_marketplace_gift_card TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_marketplace_order(UUID, JSONB, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, JSONB) TO anon, authenticated;
