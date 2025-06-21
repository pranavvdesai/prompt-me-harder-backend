SET search_path TO __SCHEMA__;

/* ================================================================
   EXTRA MOCK ROWS  (adds 2 new records to every table)
   ================================================================ */

--------------------------------------------------------------------
-- A. more merchants
--------------------------------------------------------------------
INSERT INTO merchants (google_uid, display_name, email, phone)
VALUES
  ('uid_merchant_c', 'Spice Route Express', 'spiceroute@example.com', '9001112222'),
  ('uid_merchant_d', 'Delhi Chaat House',  'chaat@example.com',      '9003334444');

--------------------------------------------------------------------
-- B. more stores  (one for each new merchant)
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
FROM (VALUES
  ('uid_merchant_c','SWG-004','Spice Route – Indiranagar',
   '100 11th Main, Indiranagar',12.9712,77.6413,4.1,120),
  ('uid_merchant_d','SWG-005','Delhi Chaat House – Jayanagar',
   '4th T Block, Jayanagar',12.9255,77.5937,4.3,150)
) AS d(uid, agg_id, name, addr, lat, lng, rating, rcount)
JOIN merchants m ON m.google_uid = d.uid;

--------------------------------------------------------------------
-- C. more menu_items
--------------------------------------------------------------------
INSERT INTO menu_items (store_id, aggregator_item_id, item_name, category,
                        variants_json, base_price, tax_percent,
                        is_veg, calories, stock_qty)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-004')
  , 'ITM-105', 'Chettinad Chicken', 'Main Course',
    '[]', 270, 5, 0, 720, 40),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-005')
  , 'ITM-106', 'Pani Puri Platter', 'Snacks',
    '[]', 90, 5, 1, 300, 100);

--------------------------------------------------------------------
-- D. more promos
--------------------------------------------------------------------
INSERT INTO promos (store_id, promo_name, promo_type, discount_type,
                    discount_value, start_dt, end_dt, rules_json, status)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-004')
  , 'Spice Hour', 'temp', 'percentage', 15,
    NOW(), NOW() + INTERVAL '3 hours',
    '{"min_order":250}', 'live'),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-005')
  , 'Evening Chaat Combo', 'combo', 'flat', 20,
    NOW(), NOW() + INTERVAL '5 days',
    '{"required_items":["ITM-106"]}', 'scheduled');

--------------------------------------------------------------------
-- E. more orders  + order_items
--------------------------------------------------------------------
WITH new_orders AS (
  INSERT INTO orders (store_id, aggregator_order_id, order_ts, status,
                      total_amount, delivery_fee, platform_commission,
                      taxes, payout_amount, customer_rating, rating_comment)
  VALUES
    ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-004')
    , 'ORD-SW-0004', NOW() - INTERVAL '45 minutes', 'delivered',
      340, 25, 45, 18, 252, 4.7, 'Loved the spice!' ),

    ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-005')
    , 'ORD-SW-0005', NOW() - INTERVAL '30 minutes', 'delivered',
      180, 20, 24,  9, 127, 4.8, 'Crisp & fresh' )

  RETURNING order_id, aggregator_order_id
)
INSERT INTO order_items (order_id, item_id, variant_name,
                         variant_price, qty, price_per_unit)
SELECT
  o.order_id,
  (SELECT item_id FROM menu_items WHERE aggregator_item_id = li.itm_code),
  NULL, 0, li.qty, li.ppu
FROM (VALUES
  ('ORD-SW-0004','ITM-105',1,270),
  ('ORD-SW-0005','ITM-106',2,90)
) AS li(ord_code,itm_code,qty,ppu)
JOIN new_orders o ON o.aggregator_order_id = li.ord_code;

--------------------------------------------------------------------
-- F. more tickets
--------------------------------------------------------------------
INSERT INTO tickets (store_id, aggregator_ticket_id, category,
                     summary, details, status, escalations_json)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-004')
  , 'TCK-891', 'serviceability_issue',
    'Area auto-blocked', 'Pin 560038 marked non-serviceable', 'open', '[]'),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-005')
  , 'TCK-892', 'payout_deduction',
    'GST mis-calculated', 'Mismatch in tax slab', 'open', '[]');

--------------------------------------------------------------------
-- G. more scheduled_tasks  +  action_logs
--------------------------------------------------------------------
INSERT INTO scheduled_tasks (store_id, task_type, cron_expr,
                             payload_json, next_run, status)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-004')
  , 'timing_change', '0 23 * * *',
    '{"close_time":"23:00"}',
    NOW() + INTERVAL '1 day', 'waiting'),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-005')
  , 'stock_refresh', '*/30 * * * *',
    '{"item_id":"ITM-106","quantity":100}',
    NOW() + INTERVAL '30 minutes', 'waiting');

INSERT INTO action_logs (store_id, actor, action_type,
                         before_state, after_state, outcome)
VALUES
  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-004')
  , 'merchant', 'menu_update',
    '{"price":270}', '{"price":290}', 'success'),

  ( (SELECT store_id FROM stores WHERE aggregator_store_id='SWG-005')
  , 'agent', 'promo_create',
    '{}', '{"promo_name":"Evening Chaat Combo"}', 'success');
