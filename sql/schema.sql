-- NOTE: the placeholder `__SCHEMA__` will be replaced by init.ts
SET search_path TO __SCHEMA__;

CREATE TABLE merchants (
  merchant_id  BIGSERIAL PRIMARY KEY,
  google_uid   VARCHAR(128) NOT NULL,
  display_name VARCHAR(255),
  email        VARCHAR(255),
  phone        VARCHAR(32),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login   TIMESTAMP NULL,
  status       VARCHAR(32) DEFAULT 'active'
);

CREATE TABLE stores (
  store_id            BIGSERIAL PRIMARY KEY,
  merchant_id         BIGINT,
  aggregator_store_id VARCHAR(128),
  store_name          VARCHAR(255),
  address_text        TEXT,
  latitude            NUMERIC(10,6),
  longitude           NUMERIC(10,6),
  current_rating      NUMERIC(3,2),
  rating_count        INT,
  status              VARCHAR(32) DEFAULT 'active',
  credentials_json    JSONB,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NULL,
  CONSTRAINT fk_stores_merchants
      FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE RESTRICT
);

CREATE TABLE menu_items (
  item_id            BIGSERIAL PRIMARY KEY,
  store_id           BIGINT,
  aggregator_item_id VARCHAR(128),
  item_name          VARCHAR(255),
  category           VARCHAR(255),
  variants_json      JSONB,
  base_price         NUMERIC(10,2),
  tax_percent        NUMERIC(5,2),
  is_veg             SMALLINT,
  calories           INT,
  stock_qty          INT,
  is_active          SMALLINT DEFAULT 1,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menu_store
      FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE RESTRICT
);

CREATE TABLE promos (
  promo_id       BIGSERIAL PRIMARY KEY,
  store_id       BIGINT,
  promo_name     VARCHAR(255),
  promo_type     VARCHAR(64),
  discount_type  VARCHAR(32),
  discount_value NUMERIC(10,2),
  start_dt       TIMESTAMP,
  end_dt         TIMESTAMP,
  rules_json     JSONB,
  status         VARCHAR(32) DEFAULT 'scheduled',
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_promos_store
      FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE RESTRICT
);

CREATE TABLE orders (
  order_id            BIGSERIAL PRIMARY KEY,
  store_id            BIGINT,
  aggregator_order_id VARCHAR(128),
  order_ts            TIMESTAMP,
  status              VARCHAR(32),
  total_amount        NUMERIC(10,2),
  delivery_fee        NUMERIC(10,2),
  platform_commission NUMERIC(10,2),
  taxes               NUMERIC(10,2),
  payout_amount       NUMERIC(10,2),
  customer_rating     NUMERIC(3,2),
  rating_comment      TEXT,
  CONSTRAINT fk_orders_store
      FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE RESTRICT
);

CREATE TABLE order_items (
  order_item_id  BIGSERIAL PRIMARY KEY,
  order_id       BIGINT,
  item_id        BIGINT,
  variant_name   VARCHAR(255),
  variant_price  NUMERIC(10,2),
  qty            INT,
  price_per_unit NUMERIC(10,2),
  CONSTRAINT fk_items_order
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT,
  CONSTRAINT fk_items_menu
      FOREIGN KEY (item_id)  REFERENCES menu_items(item_id) ON DELETE RESTRICT
);

CREATE TABLE tickets (
  ticket_id        BIGSERIAL PRIMARY KEY,
  store_id         BIGINT,
  aggregator_ticket_id VARCHAR(128),
  category         VARCHAR(64),
  summary          VARCHAR(512),
  details          TEXT,
  status           VARCHAR(32) DEFAULT 'open',
  penalty_amount   NUMERIC(10,2),
  escalations_json JSONB,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL,
  CONSTRAINT fk_tickets_store
      FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE RESTRICT
);

CREATE TABLE scheduled_tasks (
  task_id      BIGSERIAL PRIMARY KEY,
  store_id     BIGINT,
  task_type    VARCHAR(64),
  cron_expr    VARCHAR(64),
  payload_json JSONB,
  next_run     TIMESTAMP,
  last_run     TIMESTAMP,
  status       VARCHAR(32) DEFAULT 'waiting',
  CONSTRAINT fk_tasks_store
      FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE RESTRICT
);

CREATE TABLE action_logs (
  log_id       BIGSERIAL PRIMARY KEY,
  store_id     BIGINT,
  actor        VARCHAR(32),
  action_type  VARCHAR(64),
  before_state JSONB,
  after_state  JSONB,
  action_ts    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  outcome      VARCHAR(32),
  CONSTRAINT fk_logs_store
      FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS grievances (
  grievance_id   BIGSERIAL PRIMARY KEY,
  merchant_id    BIGINT NOT NULL,
  platform       VARCHAR(32),
  title          VARCHAR(255),
  description    TEXT,
  category       VARCHAR(64),
  severity       VARCHAR(16) DEFAULT 'medium',
  status         VARCHAR(32) DEFAULT 'open',
  actions_json   JSONB DEFAULT '[]',
  last_action_ts TIMESTAMP,
  next_followup_ts TIMESTAMP,
  escalation_level SMALLINT DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP,
  resolved_by    VARCHAR(64),
  resolved_at    TIMESTAMP
);

ALTER TABLE grievances
  ADD CONSTRAINT fk_grievances_merchants
  FOREIGN KEY (merchant_id)
  REFERENCES merchants(merchant_id)
  ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS store_analytics (
    analytics_id          BIGSERIAL PRIMARY KEY,
    store_id              BIGINT        NOT NULL,
    analysis_date         DATE          NOT NULL,
    total_orders          INT,
    total_revenue         NUMERIC(10,2),
    most_ordered_item     VARCHAR(255),
    least_ordered_item    VARCHAR(255),
    trending_items        JSONB,
    order_qty_per_hour    JSONB,
    most_profitable_hour  SMALLINT,
    order_qty_per_day     JSONB,
    most_profitable_day   VARCHAR(9),
    avg_store_rating      NUMERIC(3,2),
    dish_ratings          JSONB,
    revenue_recommendation TEXT,
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_analytics_store
      FOREIGN KEY (store_id)
      REFERENCES stores(store_id)
      ON DELETE RESTRICT
);
/* helper indexes */
CREATE INDEX idx_store_merchant   ON stores(merchant_id);
CREATE INDEX idx_menu_store       ON menu_items(store_id);
CREATE INDEX idx_order_store_ts   ON orders(store_id, order_ts);
CREATE INDEX idx_items_order      ON order_items(order_id);
CREATE INDEX idx_ticket_store     ON tickets(store_id);
CREATE INDEX idx_task_next_run    ON scheduled_tasks(next_run);
