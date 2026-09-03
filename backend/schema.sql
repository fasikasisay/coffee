


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
  company       VARCHAR(255)  NULL,
  country       VARCHAR(100)  NULL,
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
  INDEX idx_cust_email (customer_email)
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
