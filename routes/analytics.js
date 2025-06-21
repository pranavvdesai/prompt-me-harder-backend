/**
 * Analytics API
 * --------------
 * GET /analytics/:platform/:googleUid
 *     → latest analytics row per store for the merchant
 */

const router = require('express').Router();
const pool   = require('../db/pool');

const VALID_PLATFORMS = ['swiggy', 'zomato', 'magicpin'];

/* helper: run parametrised SQL inside chosen schema */
const q = (schema, sql, params = []) =>
  pool.query(sql.replace(/__S__/g, schema), params).then(r => r.rows);

/* ─────────────────────────────────────────────────────────── */

router.get('/:platform/:googleUid', async (req, res) => {
  const platform = req.params.platform.toLowerCase();
  const uid      = req.params.googleUid;

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ status: 'error', message: 'invalid platform' });
  }
  const S = platform;                           // schema alias

  try {
    /* 1 ▸ find merchant */
    const [merchant] = await q(
      S,
      `SELECT merchant_id, display_name
         FROM __S__.merchants
        WHERE google_uid = $1
        LIMIT 1`,
      [uid]
    );
    if (!merchant) {
      return res.status(404).json({ status: 'error', message: 'merchant not found' });
    }

    /* 2 ▸ latest analytics per store (DISTINCT ON) */
    const analyticsRows = await q(
      S,
      `SELECT DISTINCT ON (sa.store_id) sa.*
         FROM __S__.store_analytics sa
         JOIN __S__.stores          s  ON s.store_id = sa.store_id
        WHERE s.merchant_id = $1
        ORDER BY sa.store_id, sa.analysis_date DESC`,
      [merchant.merchant_id]
    );

    /* 3 ▸ shape response */
    const analytics = analyticsRows.map(a => ({
      storeId:      a.store_id,
      analysisDate: a.analysis_date,
      totals:       { orders: Number(a.total_orders),
                      revenue: Number(a.total_revenue) },
      bestSeller:   a.most_ordered_item,
      lowSeller:    a.least_ordered_item,
      trending:     a.trending_items,
      ordersPerHour:a.order_qty_per_hour,
      peakHour:     a.most_profitable_hour,
      ordersPerDay: a.order_qty_per_day,
      peakDay:      a.most_profitable_day,
      avgStoreRating: Number(a.avg_store_rating),
      dishRatings:    a.dish_ratings,
      recommendation: a.revenue_recommendation
    }));

    return res.json({
      status: 'success',
      generatedAt: new Date().toISOString(),
      data: {
        merchant: {
          merchantId:  merchant.merchant_id,
          displayName: merchant.display_name
        },
        analytics
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'internal server error' });
  }
});

module.exports = router;
