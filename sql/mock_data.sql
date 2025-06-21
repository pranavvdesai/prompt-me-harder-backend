-- mock_data.sql
-- NOTE:  init.js / seed.js will swap  __SCHEMA__  with swiggy / zomato / magicpin
SET search_path TO __SCHEMA__;

--------------------------------------------------------------------
-- 1. merchants
--------------------------------------------------------------------
INSERT INTO merchants (google_uid, display_name, email, phone)
VALUES
  ('uid_merchant_a', 'Shree Ganesh Dhaba', 'ganesh@example.com', '9876543210'),
  ('uid_merchant_b', 'Taste of Punjab',   'punjab@example.com', '9123456789');

--------------------------------------------------------------------
-- 2. stores  (3 stores → 2 merchants)
--------------------------------------------------------------------
INSERT INTO stores (merchant_id, aggregator_store_id, store_name,
                    address_text, latitude, longitude,
                    current_rating, rating_count)
SELECT
  m.merchant_id,
  d.agg_id,
  d.name,
  d.addr,
  d.lat,
  d.lng,
  d.rating,
  d.rcount
FROM (
  VALUES
    -- merchant A ---------------------------------------------------
    ('uid_merchant_a','SWG-001','Shree Ganesh Dhaba – MG Road',
     '12 MG Road, Bengaluru',12.9716,77.5946,4.4,250),
    ('uid_merchant_a','SWG-002','Shree Ganesh Dhaba – Koramangala',
     '5th Block, Koramangala',12.9345,77.6107,4.2,180),
    -- merchant B ---------------------------------------------------
    ('uid_merchant_b','SWG-003','Taste of Punjab – HSR',
     'HSR Layout Sector 7',12.9100,77.6387,4.5,300)
) AS d(uid, agg_id, name, addr, lat, lng, rating, rcount)
JOIN merchants m
  ON m.google_uid = d.uid;          -- ← explicit match


--------------------------------------------------------------------
-- 3. menu_items  (5 dishes)
--------------------------------------------------------------------
INSERT INTO menu_items (store_id, aggregator_item_id, item_name, category,
                        variants_json, base_price, tax_percent,
                        is_veg, calories, stock_qty)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
  , 'ITM-100', 'Paneer Butter Masala', 'Main Course',
    '[{"name":"Full","delta":0},{"name":"Half","delta":-70}]',
    240, 5, 1, 600, 50),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
  , 'ITM-101', 'Butter Naan', 'Bread', '[]',
    40, 5, 1, 250, 200),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
  , 'ITM-102', 'Chicken Curry', 'Main Course',
    '[{"name":"Full","delta":0},{"name":"Half","delta":-80}]',
    260, 5, 0, 700, 40),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-002')
  , 'ITM-103', 'Veg Biryani', 'Rice', '[]',
    180, 5, 1, 650, 60),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-003')
  , 'ITM-104', 'Dal Makhani', 'Main Course', '[]',
    220, 5, 1, 580, 70);

--------------------------------------------------------------------
-- 4. promos  (2 sample campaigns)
--------------------------------------------------------------------
INSERT INTO promos (store_id, promo_name, promo_type, discount_type,
                    discount_value, start_dt, end_dt, rules_json, status)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
  , 'Weekend Special', 'seasonal', 'percentage', 10,
    NOW() - INTERVAL '1 day', NOW() + INTERVAL '1 day',
    '{"min_order":300}', 'live'),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-003')
  , 'BOGO Naan', 'combo', 'free_item', 0,
    NOW(), NOW() + INTERVAL '7 days',
    '{"buy":2,"get":1,"item_id":"ITM-101"}', 'scheduled');

--------------------------------------------------------------------
-- 5. orders  +  order_items
--------------------------------------------------------------------
WITH ins AS (
  INSERT INTO orders (store_id, aggregator_order_id, order_ts, status,
                      total_amount, delivery_fee, platform_commission,
                      taxes, payout_amount, customer_rating, rating_comment)
  VALUES
    ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
    , 'ORD-SW-0001', NOW() - INTERVAL '3 hours', 'delivered',
      560, 30, 70, 25, 435, 4.5, 'Great taste!' ),

    ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
    , 'ORD-SW-0002', NOW() - INTERVAL '2 hours', 'delivered',
      320, 25, 40, 15, 240, 4.0, 'Good, but late' ),

    ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-003')
    , 'ORD-SW-0003', NOW() - INTERVAL '1 hour', 'delivered',
      450, 25, 56, 20, 349, 5.0, 'Awesome Punjabi food' )

  -- 👇 include aggregator_order_id here
  RETURNING order_id, store_id, aggregator_order_id
)
INSERT INTO order_items (order_id, item_id, variant_name,
                         variant_price, qty, price_per_unit)
SELECT 
  o.order_id,
  (SELECT item_id FROM menu_items WHERE aggregator_item_id = li.itm_code),
  li.var_name, li.var_delta, li.qty, li.ppu
FROM (
  VALUES
  /* order 1 items */
  ('ORD-SW-0001','ITM-100','Full',0,2,240),
  ('ORD-SW-0001','ITM-101',NULL,0,4,40),
  /* order 2 items */
  ('ORD-SW-0002','ITM-103',NULL,0,1,180),
  ('ORD-SW-0002','ITM-101',NULL,0,2,40),
  /* order 3 items */
  ('ORD-SW-0003','ITM-104',NULL,0,2,220)
) AS li(ord_code,itm_code,var_name,var_delta,qty,ppu)
JOIN ins  o ON o.aggregator_order_id = li.ord_code;

--------------------------------------------------------------------
-- 6. tickets
--------------------------------------------------------------------
INSERT INTO tickets (store_id, aggregator_ticket_id, category,
                     summary, details, status, escalations_json)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
  , 'TCK-889', 'payout_deduction',
    'Wrong commission charged',
    'Platform charged 30% instead of 25%',
    'open', '[]'),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-003')
  , 'TCK-890', 'rating_drop',
    'Sudden rating drop',
    'Rating fell from 4.6 to 4.2',
    'in_progress', '[]');

--------------------------------------------------------------------
-- 7. scheduled_tasks + action_logs
--------------------------------------------------------------------
INSERT INTO scheduled_tasks (store_id, task_type, cron_expr,
                             payload_json, next_run, status)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
  , 'promo_toggle', '0 9 * * 5',
    '{"promo_name":"Weekend Special","action":"enable"}',
    NOW() + INTERVAL '2 days', 'waiting');

INSERT INTO action_logs (store_id, actor, action_type,
                         before_state, after_state, outcome)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-001')
  , 'agent', 'promo_create',
    '{}', '{"promo_name":"Weekend Special"}', 'success');
