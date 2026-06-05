export type OrderReceiptLine = {
  label: string;
  qtyLabel: string;
  priceTier: string;
  unitPrice: number;
  lineTotal: number;
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
  lines: OrderReceiptLine[];
};
