const router = require('express').Router();
const pool   = require('../db/pool');

const VALID_PLATFORMS = ['swiggy', 'zomato', 'magicpin'];

/* helper: run a query in the chosen schema (__S__ → swiggy / zomato …) */
const q = (S, sql, params = []) =>
  pool.query(sql.replace(/__S__/g, S), params).then(r => r.rows);

/* ───────────────────────────────────────────── */
router.get('/:platform/:googleUid', async (req, res) => {
  const platform = req.params.platform.toLowerCase();
  const uid      = req.params.googleUid;

  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ status: 'error', message: 'invalid platform' });
  }
  const S = platform;

  try {
    /* 1. look up merchant → id */
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

    /* 2. pull grievances ordered by newest first */
    const grievances = await q(
      S,
      `SELECT grievance_id  AS id,
              title,
              description,
              category,
              severity,
              status,
              actions_json     AS actions,
              last_action_ts,
              next_followup_ts,
              escalation_level,
              created_at,
              updated_at,
              resolved_by,
              resolved_at
         FROM __S__.grievances
        WHERE merchant_id = $1
        ORDER BY created_at DESC`,
      [merchant.merchant_id]
    );

    res.json({
      status: 'success',
      data: {
        merchant: {
          merchantId: merchant.merchant_id,
          displayName: merchant.display_name,
          totalGrievances: grievances.length
        },
        grievances
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'internal server error' });
  }
});

module.exports = router;
