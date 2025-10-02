// types.ts
export type Variant = {
  id: string;
  name: string;
  unitPrice: number; // birim fiyat
};

export type Category = {
  id: string;
  name: string;
  variants: Variant[];
};

export type LineItem = {
  id: string;
  categoryId: string;
  variantId: string;
  qty: number;
  width: number;   // yeni
  height: number;  // yeni
  note?: string;
  unitPrice: number;
  subtotal: number;
};
