-- =============================================
-- StockFlow Inventory Management — Supabase Schema
-- Run this in your Supabase SQL editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  gst NUMERIC(5,2) DEFAULT 18,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batches
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER DEFAULT 0,
  purchase_rate NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  purchase_date DATE NOT NULL,
  total_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Items
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  batch_id UUID REFERENCES batches(id),
  quantity INTEGER NOT NULL,
  purchase_rate NUMERIC(10,2) NOT NULL
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('Website','Amazon','Flipkart','Myntra','Wholesale','Retail')),
  invoice_number TEXT NOT NULL,
  sale_date DATE NOT NULL,
  total_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sale Items
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  batch_id UUID REFERENCES batches(id),
  quantity INTEGER NOT NULL,
  sale_rate NUMERIC(10,2) NOT NULL
);

-- Sale Returns
CREATE TABLE sale_returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id),
  product_id UUID REFERENCES products(id),
  batch_id UUID REFERENCES batches(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Transactions
CREATE TYPE transaction_type AS ENUM ('PURCHASE', 'SALE', 'SALE_RETURN', 'BREAKAGE', 'EXPIRY');

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  batch_id UUID REFERENCES batches(id),
  transaction_type transaction_type NOT NULL,
  quantity INTEGER NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users
CREATE POLICY "Auth users full access" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON batches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON sales FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON sale_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON sale_returns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users full access" ON inventory_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- Seed Data (optional demo data)
-- =============================================
INSERT INTO products (name, sku, category, gst) VALUES
  ('Paracetamol 500mg', 'MED-001', 'Medicine', 0),
  ('Vitamin C 1000mg', 'SUP-001', 'Supplement', 12),
  ('Amoxicillin 250mg', 'MED-002', 'Medicine', 0),
  ('Omega-3 Fish Oil', 'SUP-002', 'Supplement', 12),
  ('Hand Sanitizer 200ml', 'FMCG-001', 'FMCG', 18),
  ('Dettol Soap 75g', 'FMCG-002', 'FMCG', 18);
