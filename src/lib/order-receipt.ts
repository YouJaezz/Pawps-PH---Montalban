export type OrderReceiptLine = {
  label: string;
  qtyLabel: string;
  priceTier: string;
  unitPrice: number;
  lineTotal: number;
  lineNote?: string | null;
  isExcessSale?: boolean;
};

export type OrderReceiptData = {
  orderId: number;
  customerName: string;
  contact: string | null;
  location: string | null;
  storeType: string;
  deliveryMethod: string | null;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  amountPaid: number;
  createdAt: string;
  cashierName?: string | null;
  lines: OrderReceiptLine[];
};
