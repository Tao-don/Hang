export type CustomerType = "new" | "ttd";
export type DiscountType = "percent" | "amount";
export type OrderStatus =
  | "Chờ xác nhận"
  | "Đợi gửi"
  | "Đang giao"
  | "Thành công"
  | "Chăm sóc"
  | "HD sử dụng"
  | "Xử lý"
  | "Đơn BOM 💣"
  | "Hoàn hàng"
  | "Đã Hủy";
export type PayMethod = "COD (Shipper)" | "Chuyển khoản" | "Tiền mặt";

export interface Product {
  name: string;
  price: number;
  qty: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
  birthday?: string;
  joinDate?: string;
  role: "admin" | "employee";
  coverURL?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddr: string;
  customerType: CustomerType;
  products: Product[];
  payMethod: PayMethod;
  shipFee: number;
  discount: {
    val: number;
    type: DiscountType;
  };
  orderDate: string;
  shipDate: string;
  deliveryDate: string;
  note: string;
  subtotal: number;
  total: number;
  status: OrderStatus;
  isPaid: boolean;
  paidAmount?: number;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Customer {
  id: string; // phone
  name: string;
  phone: string;
  address: string;
  birthday: string;
  anniversary: string;
  job: string;
  note: string;
  status: string;
  totalSpent: number;
  lastOrderAt?: any;
}

export type InventoryType = "vnl" | "external";

export interface InventoryItem {
  id: string;
  name: string;
  price: number;
  costPrice?: number;
  qty: number;
  type?: InventoryType;
  icon?: string;
}

export interface CVAccumulation {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
  checked: boolean;
}

export interface CVMonthlyStat {
  id: string; // month string YYYY-MM or auto ID
  month: string;
  cv: number;
  importAmt: number;
  note: string;
  createdAt?: any;
}
