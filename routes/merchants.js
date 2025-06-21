const router = require('express').Router();
const pool   = require('../db/pool');

const VALID_PLATFORMS = ['swiggy', 'zomato', 'magicpin'];
const todayStartSQL   = "date_trunc('day', current_timestamp)";

// helper → run query inside chosen schema (__S__ macro)
const q = (S, sql, params = []) =>
  pool.query(sql.replace(/__S__/g, S), params).then(r => r.rows);

// rating join reused in menu query
const RATING_CTE = `
  LEFT JOIN (
    SELECT oi.item_id,
           AVG(o.customer_rating)  AS avg_rating,
           COUNT(o.customer_rating) AS rating_count
    FROM   __S__.orders o
    JOIN   __S__.order_items oi USING (order_id)
    WHERE  o.status = 'delivered'
    GROUP  BY oi.item_id
  ) r USING (item_id)
`;

/* ────────────────────────────────────────────── */

router.get('/:platform/:googleUid', async (req, res) => {
  const platform = req.params.platform.toLowerCase();
  const uid      = req.params.googleUid;

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ status: 'error', message: 'invalid platform' });
  }
  const S = platform;                       // schema alias

  try {
    /* 1️⃣  merchant header */
    const [merchant] = await q(
      S,
      `SELECT * FROM __S__.merchants WHERE google_uid = $1 LIMIT 1`,
      [uid]
    );
    if (!merchant) {
      return res.status(404).json({ status: 'error', message: 'merchant not found' });
    }

    /* 2️⃣  stores for this merchant in this platform */
    const storeRows = await q(
      S,
      `SELECT store_id, aggregator_store_id, store_name, address_text,
              latitude, longitude, status,
              current_rating, rating_count
       FROM   __S__.stores
       WHERE  merchant_id = $1`,
      [merchant.merchant_id]
    );

    const stores = [];
    let menuCount = 0, promoCount = 0, ticketCount = 0, taskCount = 0;

    for (const s of storeRows) {
      /* today’s quick stats */
      const [{ today_orders, today_revenue }] = await q(
        S,
        `SELECT COUNT(*) AS today_orders,
                COALESCE(SUM(total_amount),0) AS today_revenue
         FROM   __S__.orders
         WHERE  store_id = $1 AND order_ts >= ${todayStartSQL}`,
        [s.store_id]
      );

      const [{ low_stock }] = await q(
        S,
        `SELECT COUNT(*) low_stock
         FROM   __S__.menu_items
         WHERE  store_id=$1 AND stock_qty < 10`,
        [s.store_id]
      );

      const [{ pend_tickets }] = await q(
        S,
        `SELECT COUNT(*) pend_tickets
         FROM   __S__.tickets
         WHERE  store_id=$1 AND status IN ('open','in_progress')`,
        [s.store_id]
      );

      const nextTask =
        (await q(
          S,
          `SELECT task_id, task_type, cron_expr, next_run
           FROM   __S__.scheduled_tasks
           WHERE  store_id=$1 AND status='waiting' AND next_run>=NOW()
           ORDER  BY next_run LIMIT 1`,
          [s.store_id]
        ))[0] || null;
      if (nextTask) taskCount++;

      /* promos */
      const promos = await q(
        S,
        `SELECT promo_id, promo_name, promo_type, status,
                discount_type, discount_value,
                start_dt, end_dt, rules_json
         FROM   __S__.promos
         WHERE  store_id=$1 AND status IN ('live','scheduled')`,
        [s.store_id]
      );
      promoCount += promos.length;

      /* tickets */
      const tickets = await q(
        S,
        `SELECT ticket_id, aggregator_ticket_id, category,
                summary, status, created_at
         FROM   __S__.tickets
         WHERE  store_id=$1 AND status IN ('open','in_progress')
         ORDER  BY created_at DESC LIMIT 5`,
        [s.store_id]
      );
      ticketCount += tickets.length;

      /* menu with dish ratings */
      const menuRows = await q(
        S,
        `SELECT mi.item_id, mi.aggregator_item_id, mi.item_name,
                mi.category, mi.is_veg, mi.calories,
                mi.base_price, mi.tax_percent,
                mi.variants_json AS variants,
                mi.stock_qty, mi.is_active,
                mi.updated_at AS last_updated,
                COALESCE(r.avg_rating,0)::numeric(3,2) AS avg_rating,
                COALESCE(r.rating_count,0)             AS rating_count
         FROM   __S__.menu_items mi
         ${RATING_CTE}
         WHERE  mi.store_id = $1`,
        [s.store_id]
      );

      const menu = menuRows.map(r => ({
        itemId: r.item_id,
        aggregatorItemId: r.aggregator_item_id,
        name: r.item_name,
        category: r.category,
        isVeg: !!r.is_veg,
        calories: r.calories,
        basePrice: Number(r.base_price),
        taxPercent: Number(r.tax_percent),
        variants: r.variants || [],         // jsonb already parsed
        stockQty: r.stock_qty,
        isActive: !!r.is_active,
        rating: { avg: Number(r.avg_rating), count: Number(r.rating_count) },
        lastUpdated: r.last_updated
      }));
      menuCount += menu.length;

      /* push assembled store */
      stores.push({
        storeId: s.store_id,
        aggregatorStoreId: s.aggregator_store_id,
        name: s.store_name,
        address: s.address_text,
        location: { lat: Number(s.latitude), lng: Number(s.longitude) },
        status: s.status,
        rating: { current: Number(s.current_rating), count: s.rating_count },
        todayOrders: Number(today_orders),
        todayRevenue: Number(today_revenue),
        alerts: {
          lowStockItems: Number(low_stock),
          pendingTickets: Number(pend_tickets)
        },
        nextScheduledTask: nextTask && {
          taskId: nextTask.task_id,
          type: nextTask.task_type,
          cronExpr: nextTask.cron_expr,
          execEta: nextTask.next_run
        },
        promos: promos.map(p => ({
          promoId: p.promo_id,
          name: p.promo_name,
          type: p.promo_type,
          status: p.status,
          discount: { mode: p.discount_type, value: Number(p.discount_value) },
          window: { start: p.start_dt, end: p.end_dt },
          rules: p.rules_json
        })),
        tickets,
        menu
      });
    }

    /* 3️⃣  final response */
    res.json({
      status: 'success',
      generatedAt: new Date().toISOString(),
      data: {
        merchant: {
          merchantId: merchant.merchant_id,
          googleUid: merchant.google_uid,
          displayName: merchant.display_name,
          email: merchant.email,
          phone: merchant.phone,
          status: merchant.status,
          createdAt: merchant.created_at,
          lastLogin: merchant.last_login,
          stats: {
            totalStores: stores.length,
            totalMenuItems: menuCount,
            openTickets: ticketCount,
            livePromos: promoCount,
            scheduledTasks: taskCount
          },
          stores
        }
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'internal server error' });
  }
});

module.exports = router;
