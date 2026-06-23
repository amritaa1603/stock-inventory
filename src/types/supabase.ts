export type TransactionType = "PURCHASE" | "SALE" | "SALE_RETURN" | "BREAKAGE" | "EXPIRY";
export type SaleChannel = "Website" | "Amazon" | "Flipkart" | "Myntra" | "Wholesale" | "Retail";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  gst: number;
  created_at: string;
}

export interface Batch {
  id: string;
  product_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_rate: number;
  created_at: string;
  product?: Product;
}

export interface Purchase {
  id: string;
  supplier_name: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  created_at: string;
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  purchase_rate: number;
  product?: Product;
  batch?: Batch;
}

export interface Sale {
  id: string;
  customer_name: string;
  channel: SaleChannel;
  invoice_number: string;
  sale_date: string;
  total_amount: number;
  created_at: string;
  sale_items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  batch_id: string;
  quantity: number;
  sale_rate: number;
  product?: Product;
  batch?: Batch;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  batch_id: string;
  transaction_type: TransactionType;
  quantity: number;
  remarks: string;
  created_at: string;
  product?: Product;
  batch?: Batch;
}
