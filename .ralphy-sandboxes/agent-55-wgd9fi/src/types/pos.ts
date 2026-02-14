export interface POSProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  stock_quantity: number;
  thc_percent: number | null;
  image_url: string | null;
}

export interface POSCartItem extends POSProduct {
  quantity: number;
  subtotal: number;
}
