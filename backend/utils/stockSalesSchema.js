/**
 * DDL for the Stock Management + Daily Sales feature.
 * Single source of truth used by utils/migrateStockSales.js
 * (the same statements are mirrored in schema.sql for fresh installs).
 */
const DDL = [
`CREATE TABLE IF NOT EXISTS stock_movements (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  product_id      INT UNSIGNED  NULL,
  product_name    VARCHAR(255)  NOT NULL,                -- snapshot: survives product deletion
  type            ENUM('initial','restock','adjustment','sale','order','order_cancel','sale_void') NOT NULL,
  quantity_change INT           NOT NULL,                -- signed: +added / -removed
  quantity_before INT UNSIGNED  NOT NULL,
  quantity_after  INT UNSIGNED  NOT NULL,
  reason          VARCHAR(255)  NOT NULL,
  reference_type  ENUM('order','sale') NULL,
  reference_id    INT UNSIGNED  NULL,
  admin_id        INT UNSIGNED  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_sm_product (product_id, created_at),
  INDEX idx_sm_created (created_at),
  INDEX idx_sm_type    (type),
  CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_sm_admin   FOREIGN KEY (admin_id)   REFERENCES admins(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS sales (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sale_number     VARCHAR(40)   NOT NULL UNIQUE,         -- SL-00001
  sale_type       ENUM('paid','credit') NOT NULL DEFAULT 'paid',
  payment_method  ENUM('cash','telebirr','cbe-birr','card') NULL,   -- paid sales only
  customer_name   VARCHAR(120)  NULL,                    -- required for credit sales
  customer_phone  VARCHAR(40)   NULL,                    -- contact for credit sales
  notes           VARCHAR(500)  NULL,
  total_amount    DECIMAL(14,2) NOT NULL CHECK (total_amount >= 0),
  total_quantity  INT UNSIGNED  NOT NULL,
  amount_paid     DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),  -- credit sales: collected so far
  credit_status   ENUM('unpaid','partial','paid') NULL,  -- credit sales only
  status          ENUM('completed','voided') NOT NULL DEFAULT 'completed',
  voided_at       DATETIME      NULL,
  void_reason     VARCHAR(255)  NULL,
  admin_id        INT UNSIGNED  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_sales_created (created_at),
  INDEX idx_sales_status  (status),
  INDEX idx_sales_payment (payment_method),
  INDEX idx_sales_type    (sale_type, created_at),
  INDEX idx_sales_credit  (credit_status),
  CONSTRAINT chk_sales_type CHECK (
    (sale_type = 'paid'   AND payment_method IS NOT NULL AND credit_status IS NULL) OR
    (sale_type = 'credit' AND credit_status IS NOT NULL)
  ),
  CONSTRAINT fk_sales_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

`CREATE TABLE IF NOT EXISTS sale_items (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sale_id     INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NULL,
  name        VARCHAR(255)  NOT NULL,                    -- product name snapshot
  quantity    INT UNSIGNED  NOT NULL CHECK (quantity > 0),
  unit_price  DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  line_total  DECIMAL(14,2) NOT NULL CHECK (line_total >= 0),

  PRIMARY KEY (id),
  INDEX idx_si_sale (sale_id),
  CONSTRAINT fk_si_sale    FOREIGN KEY (sale_id)    REFERENCES sales(id)    ON DELETE CASCADE,
  CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
`CREATE TABLE IF NOT EXISTS credit_payments (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  sale_id         INT UNSIGNED  NOT NULL,
  amount          DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  payment_method  ENUM('cash','telebirr','cbe-birr','card') NOT NULL,
  note            VARCHAR(255)  NULL,
  admin_id        INT UNSIGNED  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_cp_sale    (sale_id),
  INDEX idx_cp_created (created_at),
  CONSTRAINT fk_cp_sale  FOREIGN KEY (sale_id)  REFERENCES sales(id)  ON DELETE CASCADE,
  CONSTRAINT fk_cp_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

const ADD_THRESHOLD_COLUMN =
  `ALTER TABLE products
     ADD COLUMN low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 100 AFTER stock`;

/** Upgrades an existing (pre-credit) sales table in one statement. */
const ADD_CREDIT_COLUMNS = `
  ALTER TABLE sales
    ADD COLUMN sale_type      ENUM('paid','credit') NOT NULL DEFAULT 'paid' AFTER sale_number,
    MODIFY COLUMN payment_method ENUM('cash','telebirr','cbe-birr','card') NULL,
    ADD COLUMN customer_phone VARCHAR(40) NULL AFTER customer_name,
    ADD COLUMN amount_paid    DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER total_quantity,
    ADD COLUMN credit_status  ENUM('unpaid','partial','paid') NULL AFTER amount_paid,
    ADD INDEX idx_sales_type (sale_type, created_at),
    ADD INDEX idx_sales_credit (credit_status),
    ADD CONSTRAINT chk_sales_amount_paid CHECK (amount_paid >= 0),
    ADD CONSTRAINT chk_sales_type CHECK (
      (sale_type = 'paid'   AND payment_method IS NOT NULL AND credit_status IS NULL) OR
      (sale_type = 'credit' AND credit_status IS NOT NULL)
    )`;

module.exports = { DDL, ADD_THRESHOLD_COLUMN, ADD_CREDIT_COLUMNS };
