


-- Database 
CREATE DATABASE IF NOT EXISTS misrak_coffee
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
  
USE misrak_coffee;

-- ── admins 
CREATE TABLE IF NOT EXISTS admins (
  id                    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name                  VARCHAR(60)      NOT NULL,
  email                 VARCHAR(255)     NOT NULL UNIQUE,
  password              VARCHAR(255)     NOT NULL,   -- bcrypt hash, never plain-text
  role                  ENUM('admin','superadmin') NOT NULL DEFAULT 'admin',
  is_active             TINYINT(1)       NOT NULL DEFAULT 1,
  last_login            DATETIME         NULL,
  reset_password_token  VARCHAR(255)     NULL,
  reset_password_expire DATETIME         NULL,
  created_at            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_email    (email),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── products 
CREATE TABLE IF NOT EXISTS products (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name          VARCHAR(255)  NOT NULL,
  slug          VARCHAR(255)  NOT NULL UNIQUE,
  category      ENUM('green-beans','roasted','specialty','blend') NOT NULL,
  description   TEXT          NULL,
  price_per_kg  DECIMAL(10,2) NOT NULL CHECK (price_per_kg > 0),
  min_order_kg  INT UNSIGNED  NOT NULL DEFAULT 1,
  stock         INT UNSIGNED  NOT NULL DEFAULT 0,
  low_stock_threshold INT UNSIGNED NOT NULL DEFAULT 100,   -- stock <= this => 'Low Stock'
  origin        VARCHAR(100)  NOT NULL DEFAULT 'Ethiopia',
  region        VARCHAR(100)  NULL,
  process       VARCHAR(100)  NULL,
  grade         VARCHAR(50)   NULL,
  is_available  TINYINT(1)    NOT NULL DEFAULT 1,
  image         VARCHAR(500)  NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_category     (category),
  INDEX idx_is_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── customers 
CREATE TABLE IF NOT EXISTS customers (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name          VARCHAR(255)  NOT NULL,
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password      VARCHAR(255)  NULL,
  company       VARCHAR(255)  NULL,
  country       VARCHAR(100)  NULL,
  street        VARCHAR(255)  NULL,
  city          VARCHAR(100)  NULL,
  postal_code   VARCHAR(20)   NULL,
  phone         VARCHAR(50)   NULL,
  total_orders  INT UNSIGNED  NOT NULL DEFAULT 0,
  total_spent   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  notes         TEXT          NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_email     (email),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--  orders 
CREATE TABLE IF NOT EXISTS orders (
  id                   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_number         VARCHAR(20)   NOT NULL UNIQUE,   -- MC-00001
  -- customer snapshot
  customer_id          INT UNSIGNED  NULL,
  customer_name        VARCHAR(255)  NOT NULL,
  customer_email       VARCHAR(255)  NOT NULL,
  customer_company     VARCHAR(255)  NULL,
  customer_country     VARCHAR(100)  NULL,
  customer_phone       VARCHAR(50)   NULL,
  -- financials — always computed server-side, 
  total_amount         DECIMAL(14,2) NOT NULL CHECK (total_amount >= 0),
  status               ENUM('pending','confirmed','processing','shipped','delivered','cancelled')
                                     NOT NULL DEFAULT 'pending',
  notes                TEXT          NULL,
  -- shipping
  shipping_street      VARCHAR(255)  NULL,
  shipping_city        VARCHAR(100)  NULL,
  shipping_country     VARCHAR(100)  NULL,
  shipping_postal_code VARCHAR(20)   NULL,

  created_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                     ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at),
  INDEX idx_cust_email (customer_email),
  INDEX idx_cust_id    (customer_id),
  CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--  order_items
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id    INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NULL,
  name        VARCHAR(255)  NOT NULL,               -- product name snapshot
  quantity    INT UNSIGNED  NOT NULL CHECK (quantity > 0),
  unit_price  DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),

  PRIMARY KEY (id),
  INDEX idx_order_id (order_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--  enquiries

CREATE TABLE IF NOT EXISTS enquiries (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(255)  NOT NULL,
   phone         VARCHAR(50)   DEFAULT NULL,
  message       TEXT          NOT NULL,
  status        ENUM('new','read','responded','archived') NOT NULL DEFAULT 'new',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_status     (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- wishlists
CREATE TABLE IF NOT EXISTS wishlists (
  customer_id   INT UNSIGNED  NOT NULL,
  product_id    INT UNSIGNED  NOT NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (customer_id, product_id),
  CONSTRAINT fk_wishlist_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



-- ── stock management, daily sales & credit sales
-- (existing databases: run  npm run migrate:stock )
CREATE TABLE IF NOT EXISTS stock_movements (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sale_items (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS credit_payments (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
