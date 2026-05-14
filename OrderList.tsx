import { getTenantCollection, getTenantDoc } from "../lib/tenant";
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  increment,
  writeBatch,
  limit,
} from "firebase/firestore";
import {
  Order,
  Product,
  OrderStatus,
  PayMethod,
  CustomerType,
  DiscountType,
  Customer,
  InventoryItem,
} from "../types";
import { useAuth } from "../AuthProvider";
import {
  formatMoney,
  parseCurrency,
  formatCurrencyInput,
  cn,
  showToast,
  detectInventoryType,
  removeVietnameseTones,
} from "../lib/utils";
import * as XLSX from "xlsx";
import {
  Plus,
  Trash2,
  ChevronDown,
  Copy,
  BadgeCheck,
  Receipt,
  PenSquare,
  Search,
  FileDown,
  FileUp,
  Check,
  Truck,
  ShoppingBag,
  RotateCcw,
  Smartphone,
  User,
  MapPin,
  Calendar,
  Printer,
  FileSpreadsheet,
  Eye,
  CreditCard,
  Clock,
  CheckCircle2,
  Heart,
  BookOpen,
  AlertCircle,
  Bomb,
  XCircle,
} from "lucide-react";

import { InvoicePreviewModal } from "./InvoicePreviewModal";

const getPresetDates = (preset: string) => {
  if (preset === "all" || preset === "custom") return { start: "", end: "" };
  const today = new Date();
  let end = new Date(today);
  let start = new Date(today);

  if (preset === "7days") {
    start.setDate(today.getDate() - 7);
  } else if (preset === "15days") {
    start.setDate(today.getDate() - 15);
  } else if (preset === "30days") {
    start.setDate(today.getDate() - 30);
  } else if (preset === "lastMonth") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (preset === "thisMonth") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  }

  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return { start: formatDate(start), end: formatDate(end) };
};

const ORDER_STATUS_CONFIG: {
  label: OrderStatus;
  icon: any;
  className: string;
}[] = [
  {
    label: "Chờ xác nhận",
    icon: Clock,
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    label: "Đợi gửi",
    icon: Truck,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    label: "Đang giao",
    icon: Truck,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    label: "Thành công",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    label: "Chăm sóc",
    icon: Heart,
    className: "bg-pink-50 text-pink-700 border-pink-200",
  },
  {
    label: "HD sử dụng",
    icon: BookOpen,
    className: "bg-violet-50 text-violet-700 border-violet-200",
  },
  {
    label: "Xử lý",
    icon: AlertCircle,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  {
    label: "Đơn BOM 💣",
    icon: Bomb,
    className: "bg-stone-100 text-stone-700 border-stone-300",
  },
  {
    label: "Hoàn hàng",
    icon: RotateCcw,
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    label: "Đã Hủy",
    icon: XCircle,
    className: "bg-slate-100 text-slate-500 border-slate-300",
  },
];

function OrderStatusDropdown({
  value,
  onChange,
}: {
  value: OrderStatus;
  onChange: (v: OrderStatus) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentStatus =
    ORDER_STATUS_CONFIG.find((s) => s.label === value) ||
    ORDER_STATUS_CONFIG[1];
  const Icon = currentStatus.icon;

  return (
    <div
      className={cn(
        "relative inline-block min-w-[130px] w-full",
        isOpen ? "z-50" : "z-10",
      )}
      ref={ref}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={cn(
          "w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all border outline-none shadow-sm h-[32px]",
          currentStatus.className,
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Icon size={14} className="shrink-0" />
          <span className="truncate">{currentStatus.label}</span>
        </span>
        <ChevronDown
          size={14}
          strokeWidth={3}
          className={cn(
            "shrink-0 opacity-50 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 left-0 top-full mt-1.5 w-[160px] max-h-[250px] overflow-y-auto hide-scrollbar bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-sky-100/50 py-1.5 backdrop-blur-xl z-50 text-left"
          >
            {ORDER_STATUS_CONFIG.map((status) => {
              const SIcon = status.icon;
              return (
                <button
                  key={status.label}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(status.label);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left flex items-center gap-2.5 px-3 py-2 text-[11px] font-black uppercase tracking-wider hover:bg-sky-50 transition-all",
                    status.label === value
                      ? "text-deep-teal bg-sky-50/50"
                      : "text-deep-teal/60",
                  )}
                >
                  <SIcon
                    size={14}
                    className={cn(
                      status.label === value ? "text-coral" : "opacity-60",
                    )}
                  />
                  {status.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const OrderList = ({
  onEditOrder,
}: {
  onEditOrder: (order: any) => void;
}) => {
  const { user, isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const [viewInvoiceOrder, setViewInvoiceOrder] = useState<Order | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState(
    `DanhSachDonHang_${new Date().toISOString().split("T")[0]}`,
  );
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const ITEMS_PER_PAGE = 20;
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);

  const handleExportExcel = () => {
    try {
      let dataToExport = orders;

      if (exportStartDate && exportEndDate) {
        dataToExport = dataToExport.filter((o) => {
          const date = new Date(o.orderDate);
          return (
            date >= new Date(exportStartDate + "T00:00:00") &&
            date <= new Date(exportEndDate + "T23:59:59")
          );
        });
      } else if (exportStartDate) {
        dataToExport = dataToExport.filter(
          (o) =>
            new Date(o.orderDate) >= new Date(exportStartDate + "T00:00:00"),
        );
      } else if (exportEndDate) {
        dataToExport = dataToExport.filter(
          (o) => new Date(o.orderDate) <= new Date(exportEndDate + "T23:59:59"),
        );
      }

      const data = dataToExport.map((o) => ({
        "Mã ĐH": o.id,
        "Khách hàng": o.customerName,
        "Số điện thoại": o.customerPhone,
        "Địa chỉ": o.customerAddr,
        "Ngày tạo": o.orderDate,
        "Ngày nhận": o.shipDate,
        "Trạng thái": o.status,
        "Hình thức TT": o.payMethod,
        "Sản phẩm": o.products.map((p) => `${p.name} (x${p.qty})`).join(", "),
        "Tổng tiền": o.total,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      XLSX.writeFile(wb, `${exportFileName || "DanhSachDonHang"}.xlsx`);
      setIsExportModalOpen(false);
      showToast("Đã xuất file Excel!");
    } catch (error) {
      console.error(error);
      showToast("Lỗi khi xuất file Excel!");
    }
  };

  const importFromExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const parsedData = XLSX.utils.sheet_to_json(ws);
      const rowsToImport = [...(parsedData as any[])].reverse();

      let importedCount = 0;
      for (const row of rowsToImport) {
        const phone = String(row["Số điện thoại"] || "").trim();
        const customerName = String(
          row["Khách hàng"] || row["Tên khách hàng"] || "",
        ).trim();

        if (!phone || !customerName) continue;

        // Parse products if possible
        const productsStr = String(row["Sản phẩm"] || "");
        const products: Product[] = [];
        if (productsStr) {
          const items = productsStr.split(",");
          for (const item of items) {
            const nameMatch = item.trim().match(/^(.*?)(?:\s*\(x(\d+)\))?$/);
            if (nameMatch) {
              const pName = nameMatch[1].trim();
              const pQty = parseInt(nameMatch[2]) || 1;
              products.push({ name: pName, price: 0, qty: pQty });
            }
          }
        }

        const total = Number(row["Tổng tiền"] || 0);

        const newOrder = {
          customerName: customerName.substring(0, 100),
          customerPhone: phone.substring(0, 20),
          customerAddr: String(row["Địa chỉ"] || "").substring(0, 200),
          customerType: "Mới",
          products:
            products.length > 0
              ? products
              : [{ name: "Sản phẩm nhập từ Excel", price: total, qty: 1 }],
          payMethod: String(
            row["Hình thức TT"] || "COD (Shipper)",
          ) as PayMethod,
          shipFee: 0,
          discount: { val: 0, type: "amount" as DiscountType },
          orderDate: String(
            row["Ngày tạo"] || new Date().toISOString().split("T")[0],
          ),
          shipDate: String(
            row["Ngày nhận"] || new Date().toISOString().split("T")[0],
          ),
          deliveryDate: String(
            row["Ngày nhận"] || new Date().toISOString().split("T")[0],
          ),
          note: String(row["Ghi chú"] || "Nhập từ file Excel"),
          subtotal: total,
          total: total,
          status: String(row["Trạng thái"] || "Xử lý") as OrderStatus,
          isPaid: false,
          createdAt: serverTimestamp(),
        };

        await addDoc(getTenantCollection("orders", user), newOrder);
        importedCount++;
      }

      showToast(`Đã nhập thành công ${importedCount} đơn hàng!`);
    } catch (error) {
      console.error(error);
      showToast("Lỗi định dạng file Excel!");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const initialOrderPreset = "thisMonth";
  const initialShipPreset = "all";
  const { start: initOrderStart, end: initOrderEnd } =
    getPresetDates(initialOrderPreset);
  const { start: initShipStart, end: initShipEnd } =
    getPresetDates(initialShipPreset);

  // Filter State
  const [filterCustType, setFilterCustType] = useState<CustomerType | "all">(
    "all",
  );
  const [filterPayMethod, setFilterPayMethod] = useState<PayMethod | "all">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<
    "all" | "paid" | "unpaid" | "partial"
  >("all");
  const [filterOrderDatePreset, setFilterOrderDatePreset] =
    useState(initialOrderPreset);
  const [filterShipDatePreset, setFilterShipDatePreset] =
    useState(initialShipPreset);
  const [filterOrderStartDate, setFilterOrderStartDate] =
    useState(initOrderStart);
  const [filterOrderEndDate, setFilterOrderEndDate] = useState(initOrderEnd);
  const [filterShipStartDate, setFilterShipStartDate] = useState(initShipStart);
  const [filterShipEndDate, setFilterShipEndDate] = useState(initShipEnd);

  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [
    search,
    filterCustType,
    filterPayMethod,
    filterStatus,
    filterOrderStartDate,
    filterOrderEndDate,
    filterShipStartDate,
    filterShipEndDate,
  ]);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [custPhone, setCustPhone] = useState("");
  const [custName, setCustName] = useState("");
  const [custAddr, setCustAddr] = useState("");
  const [custType, setCustType] = useState<CustomerType>("new");
  const [products, setProducts] = useState<Product[]>([
    { name: "", price: 0, qty: 1 },
  ]);
  const [payMethod, setPayMethod] = useState<PayMethod>("COD (Shipper)");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [shipDate, setShipDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [deliveryDate, setDeliveryDate] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [shipFee, setShipFee] = useState("0");
  const [discountVal, setDiscountVal] = useState("0");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");

  const [activeSearchField, setActiveSearchField] = useState<
    "phone" | "name" | null
  >(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<Customer[]>(
    [],
  );
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<InventoryItem[]>(
    [],
  );
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [activeSuggestionRow, setActiveSuggestionRow] = useState<number | null>(
    null,
  );
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);

  const handleOrderPresetChange = (preset: string) => {
    setFilterOrderDatePreset(preset);
    if (preset !== "custom") {
      const dates = getPresetDates(preset);
      setFilterOrderStartDate(dates.start);
      setFilterOrderEndDate(dates.end);
    }
  };

  const handleShipPresetChange = (preset: string) => {
    setFilterShipDatePreset(preset);
    if (preset !== "custom") {
      const dates = getPresetDates(preset);
      setFilterShipStartDate(dates.start);
      setFilterShipEndDate(dates.end);
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      getTenantCollection("customers", user),
      orderBy("name", "asc"),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setAllCustomers(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Customer,
          ),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "customers"),
    );
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      getTenantCollection("inventory", user),
      orderBy("name", "asc"),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        setAllInventory(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as InventoryItem,
          ),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "inventory"),
    );
  }, [user]);

  const handlePhoneChange = (val: string) => {
    setCustPhone(val);
    setActiveSearchField("phone");
    if (val.length > 2) {
      const lowerVal = removeVietnameseTones(val.toLowerCase());
      setCustomerSuggestions(
        allCustomers
          .filter(
            (c) =>
              c.phone.includes(val) ||
              removeVietnameseTones(c.name || "")
                .toLowerCase()
                .includes(lowerVal),
          )
          .slice(0, 5),
      );
    } else {
      setCustomerSuggestions([]);
    }
  };

  const handleNameChange = (val: string) => {
    setCustName(val);
    setActiveSearchField("name");
    if (val.length > 1) {
      const lowerVal = removeVietnameseTones(val.toLowerCase());
      setCustomerSuggestions(
        allCustomers
          .filter(
            (c) =>
              removeVietnameseTones(c.name || "")
                .toLowerCase()
                .includes(lowerVal) || c.phone.includes(val),
          )
          .slice(0, 5),
      );
    } else {
      setCustomerSuggestions([]);
    }
  };

  const selectCustomer = (c: Customer) => {
    setCustPhone(c.phone);
    setCustName(c.name);
    setCustAddr(c.address);
    setCustType("ttd");
    setCustomerSuggestions([]);
    setActiveSearchField(null);
  };

  const handleProductSearch = (
    val: string,
    index: number,
    isFocus: boolean = false,
  ) => {
    if (!isFocus) {
      updateProduct(index, "name", val);
    }
    setActiveSuggestionRow(index);
    if (val.trim() === "") {
      setProductSuggestions(allInventory.slice(0, 5));
    } else {
      const lowerVal = removeVietnameseTones(val.toLowerCase());
      setProductSuggestions(
        allInventory
          .filter((p) =>
            removeVietnameseTones(p.name || "")
              .toLowerCase()
              .includes(lowerVal),
          )
          .slice(0, 5),
      );
    }
  };

  const selectProduct = (p: InventoryItem, index: number) => {
    const newProducts = [...products];
    newProducts[index] = {
      ...newProducts[index],
      name: p.name,
      price: p.price,
    };
    setProducts(newProducts);
    setProductSuggestions([]);
    setActiveSuggestionRow(null);
  };

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const q = query(
      getTenantCollection("orders", user),
      orderBy("createdAt", "desc"),
      limit(displayedCount),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setOrders(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Order),
        );
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "orders"),
    );
    return unsubscribe;
  }, [user, displayedCount]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && orders.length >= displayedCount) {
          setDisplayedCount((prev) => prev + ITEMS_PER_PAGE);
        }
      },
      { threshold: 0.1 },
    );

    const btn = document.getElementById("load-more-btn");
    if (btn) {
      observer.observe(btn);
    }

    return () => observer.disconnect();
  }, [orders.length, displayedCount]);

  const resetForm = () => {
    setEditingId(null);
    setCustPhone("");
    setCustName("");
    setCustAddr("");
    setCustType("new");
    setProducts([{ name: "", price: 0, qty: 1 }]);
    setPayMethod("COD (Shipper)");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setShipDate(new Date().toISOString().split("T")[0]);
    setDeliveryDate("");
    setOrderNote("");
    setShipFee("0");
    setDiscountVal("0");
    setDiscountType("amount");
  };

  const addProductRow = () => {
    setProducts([...products, { name: "", price: 0, qty: 1 }]);
  };

  const removeProductRow = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, field: keyof Product, value: any) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setProducts(newProducts);
  };

  const [isSaving, setIsSaving] = useState(false);

  const calculateTotals = () => {
    const subtotal = products.reduce((acc, p) => acc + p.price * p.qty, 0);
    const ship = parseCurrency(shipFee);
    const disc =
      discountType === "percent"
        ? subtotal * (parseCurrency(discountVal) / 100)
        : parseCurrency(discountVal);
    const total = Math.max(0, subtotal - disc + ship);
    return { subtotal, total };
  };

  const saveOrder = async () => {
    if (isSaving) return;
    if (!custPhone || !custName) {
      alert("Vui lòng nhập tên và SĐT khách!");
      return;
    }

    const { subtotal, total } = calculateTotals();
    const orderData: any = {
      customerName: custName,
      customerPhone: custPhone,
      customerAddr: custAddr,
      customerType: custType,
      products: products.filter((p) => p.name && p.price >= 0),
      payMethod,
      shipFee: parseCurrency(shipFee),
      discount: { val: parseCurrency(discountVal), type: discountType },
      orderDate,
      shipDate,
      deliveryDate,
      note: orderNote,
      subtotal,
      total,
      updatedAt: serverTimestamp(),
    };

    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      // 1. Order
      let orderRef;
      if (editingId) {
        orderRef = getTenantDoc("orders", editingId, user);
        batch.update(orderRef, orderData);
      } else {
        orderRef = doc(getTenantCollection("orders", user));
        batch.set(
          orderRef,
          {
            ...orderData,
            status: "Đợi gửi",
            isPaid: false,
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      // 2. Customer
      const custRef = getTenantDoc("customers", custPhone, user);
      const isNewCustomer = !allCustomers.find((c) => c.phone === custPhone);
      const custData: any = {
        name: custName,
        phone: custPhone,
        address: custAddr,
        totalSpent: increment(editingId ? 0 : total),
        lastOrderAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isNewCustomer) {
        custData.status = "Chưa PL";
      }

      batch.set(custRef, custData, { merge: true });

      // 3. Inventory
      orderData.products.forEach((p: Product) => {
        const invMatch = allInventory.find(
          (item) =>
            (item.name || "").trim().toLowerCase() ===
            (p.name || "").trim().toLowerCase(),
        );
        if (invMatch) {
          if (!editingId) {
            const invDoc = getTenantDoc("inventory", invMatch.id, user);
            batch.update(invDoc, { qty: increment(-p.qty) });
          }
        } else {
          const newInvRef = doc(getTenantCollection("inventory", user));
          batch.set(
            newInvRef,
            {
              name: p.name,
              price: p.price,
              qty: editingId ? 0 : -p.qty,
              type: detectInventoryType(p.name),
              createdAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      });

      await batch.commit();
      resetForm();
      showToast(
        editingId ? "Đã cập nhật đơn hàng!" : "Đã lưu đơn hàng thành công!",
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "orders");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteOrder = async (order: Order) => {
    try {
      const batch = writeBatch(db);

      // 1. Restore Inventory
      order.products.forEach((p: Product) => {
        const invMatch = allInventory.find(
          (item) =>
            (item.name || "").trim().toLowerCase() ===
            (p.name || "").trim().toLowerCase(),
        );
        if (invMatch) {
          const invDoc = getTenantDoc("inventory", invMatch.id, user);
          batch.update(invDoc, { qty: increment(p.qty) });
        }
      });

      // 2. Adjust Customer total spent
      if (order.customerPhone) {
        const custRef = getTenantDoc("customers", order.customerPhone, user);
        batch.set(
          custRef,
          {
            name: (order.customerName || "Khách hàng").substring(0, 100),
            phone: order.customerPhone.substring(0, 20),
            totalSpent: increment(-(Number(order.total) || 0)),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      // 3. Delete Order
      batch.delete(getTenantDoc("orders", order.id, user));

      await batch.commit();
      setOrderToDelete(null);
      showToast("Đã xóa đơn hàng và hoàn kho!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${order.id}`);
    }
  };

  const deleteAllOrders = async () => {
    try {
      const ordersSnapshot = orders;
      if (ordersSnapshot.length === 0) {
        showToast("Không có đơn hàng nào để xóa");
        return;
      }

      let batch = writeBatch(db);
      let operationCount = 0;
      let totalDeleted = 0;

      for (const order of ordersSnapshot) {
        // Restore inventory
        order.products.forEach((p: Product) => {
          const invMatch = allInventory.find(
            (item) =>
              (item.name || "").trim().toLowerCase() ===
              (p.name || "").trim().toLowerCase(),
          );
          if (invMatch) {
            const invDoc = getTenantDoc("inventory", invMatch.id, user);
            batch.update(invDoc, { qty: increment(p.qty) });
            operationCount++;
          }
        });

        // Customer
        if (order.customerPhone) {
          const custRef = getTenantDoc("customers", order.customerPhone, user);
          batch.set(
            custRef,
            {
              name: (order.customerName || "Khách hàng").substring(0, 100),
              phone: order.customerPhone.substring(0, 20),
              totalSpent: increment(-(Number(order.total) || 0)),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
          operationCount++;
        }

        // Order
        batch.delete(getTenantDoc("orders", order.id, user));
        operationCount++;
        totalDeleted++;

        if (operationCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      setIsDeleteAllModalOpen(false);
      showToast(`Đã xóa tất cả ${totalDeleted} đơn hàng và hoàn kho!`);
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi xóa tất cả đơn hàng!");
    }
  };

  const changeStatus = async (id: string, status: OrderStatus) => {
    try {
      await updateDoc(getTenantDoc("orders", id, user), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const togglePaid = async (id: string, current: boolean, total: number) => {
    try {
      const newIsPaid = !current;
      await updateDoc(getTenantDoc("orders", id, user), {
        isPaid: newIsPaid,
        paidAmount: newIsPaid ? total : 0,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const handleEdit = (order: Order) => {
    onEditOrder(order);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopy = (order: Order) => {
    const textToCopy = `Họ tên: ${order.customerName}\nSĐT: ${order.customerPhone}\nĐịa chỉ: ${order.customerAddr || "Chưa cung cấp địa chỉ"}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          showToast("Đã sao chép thông tin khách hàng!");
        })
        .catch(() => {
          showToast("Lỗi khi sao chép vào bộ nhớ tạm!");
        });
    } else {
      // Fallback for older browsers or insecure contexts
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showToast("Đã sao chép thông tin khách hàng!");
      } catch (err) {
        showToast("Trình duyệt không hỗ trợ sao chép!");
      }
      document.body.removeChild(textArea);
    }
  };

  const filteredOrders = useMemo(() => {
    const searchNormalized = removeVietnameseTones(search.toLowerCase());
    return orders.filter((o) => {
      const matchSearch =
        removeVietnameseTones(o.customerName || "")
          .toLowerCase()
          .includes(searchNormalized) || o.customerPhone.includes(search);
      const matchCustType =
        filterCustType === "all" || o.customerType === filterCustType;
      const matchPayMethod =
        filterPayMethod === "all" || o.payMethod === filterPayMethod;
      const matchStatus = filterStatus === "all" || o.status === filterStatus;

      let matchPaymentStatus = true;
      if (filterPaymentStatus === "paid") {
        matchPaymentStatus =
          o.isPaid || (o.paidAmount !== undefined && o.paidAmount >= o.total);
      } else if (filterPaymentStatus === "unpaid") {
        matchPaymentStatus = !o.isPaid && (!o.paidAmount || o.paidAmount === 0);
      } else if (filterPaymentStatus === "partial") {
        matchPaymentStatus =
          !o.isPaid &&
          o.paidAmount !== undefined &&
          o.paidAmount > 0 &&
          o.paidAmount < o.total;
      }

      const matchOrderDate =
        (!filterOrderStartDate || o.orderDate >= filterOrderStartDate) &&
        (!filterOrderEndDate || o.orderDate <= filterOrderEndDate);
      const matchShipDate =
        (!filterShipStartDate || o.shipDate >= filterShipStartDate) &&
        (!filterShipEndDate || o.shipDate <= filterShipEndDate);
      return (
        matchSearch &&
        matchCustType &&
        matchPayMethod &&
        matchStatus &&
        matchPaymentStatus &&
        matchOrderDate &&
        matchShipDate
      );
    });
  }, [
    orders,
    search,
    filterCustType,
    filterPayMethod,
    filterStatus,
    filterPaymentStatus,
    filterOrderStartDate,
    filterOrderEndDate,
    filterShipStartDate,
    filterShipEndDate,
  ]);

  const { total } = calculateTotals();

  return (
    <div className="order-list-wrapper">
      {/* Orders Table Container */}
      <section className="glass-card">
        <div className="flex flex-col mb-4 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <h2 className="text-xl font-black text-deep-teal flex items-center gap-3 shrink-0">
              <span className="w-2 h-8 bg-coral rounded-full"></span>
              Danh sách đơn hàng
              <span className="bg-sky-100 text-sky-600 text-xs px-2 py-0.5 rounded-full">
                {filteredOrders.length}
              </span>
            </h2>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto shrink-0 justify-start lg:justify-end">
              <div className="flex items-center gap-1.5 shrink-0 flex-1 sm:flex-none">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20 group shadow-sm flex-1 sm:flex-none"
                  title="Nhập Excel"
                >
                  <FileUp
                    size={14}
                    className="group-hover:-translate-y-0.5 transition-transform"
                  />
                  <span className="whitespace-nowrap">Nhập</span>
                </button>
                <input
                  type="file"
                  hidden
                  accept=".xlsx, .xls"
                  ref={fileInputRef}
                  onChange={importFromExcel}
                />

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20 group shadow-sm flex-1 sm:flex-none"
                  title="Xuất Excel"
                >
                  <FileDown
                    size={14}
                    className="group-hover:translate-y-0.5 transition-transform"
                  />
                  <span className="whitespace-nowrap">Xuất</span>
                </button>
                <button
                  onClick={() => setIsDeleteAllModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 group shadow-sm flex-1 sm:flex-none"
                  title="Xóa tất cả đơn hàng"
                >
                  <Trash2
                    size={14}
                    className="group-hover:translate-y-0.5 transition-transform"
                  />
                  <span className="whitespace-nowrap">Xóa tất cả</span>
                </button>
              </div>

              <div className="relative w-full sm:w-[320px] lg:w-[400px] shrink-0">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-deep-teal/40"
                />
                <input
                  type="search"
                  placeholder="Tìm tên, SĐT..."
                  className="theme-input pl-12 h-11 text-sm w-full shadow-sm border-sky-100 focus:border-deep-teal/30"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 w-full bg-white/60 p-4 border border-sky-50 rounded-2xl shadow-sm overflow-hidden">
            {/* Filters Row */}
            <div className="flex flex-nowrap items-center gap-3 w-full overflow-x-auto hide-scrollbar flex-1 pb-1">
              <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-1.5 rounded-xl border border-deep-teal/5 shrink-0">
                <span className="text-[9px] font-black text-deep-teal/40 uppercase tracking-widest whitespace-nowrap">
                  Khách
                </span>
                <select
                  value={filterCustType}
                  onChange={(e) => setFilterCustType(e.target.value as any)}
                  className="bg-transparent border-none text-[11px] font-black text-deep-teal focus:ring-0 cursor-pointer p-0 pr-6"
                >
                  <option value="all">Tất cả</option>
                  <option value="new">Mới</option>
                  <option value="ttd">TTD</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-1.5 rounded-xl border border-deep-teal/5 shrink-0">
                <span className="text-[9px] font-black text-deep-teal/40 uppercase tracking-widest whitespace-nowrap">
                  T.Toán
                </span>
                <select
                  value={filterPayMethod}
                  onChange={(e) => setFilterPayMethod(e.target.value as any)}
                  className="bg-transparent border-none text-[11px] font-black text-deep-teal focus:ring-0 cursor-pointer p-0 pr-6"
                >
                  <option value="all">Tất cả</option>
                  <option value="COD (Shipper)">COD</option>
                  <option value="Chuyển khoản">CK</option>
                  <option value="Tiền mặt">TM</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-1.5 rounded-xl border border-deep-teal/5 shrink-0">
                <span className="text-[9px] font-black text-deep-teal/40 uppercase tracking-widest whitespace-nowrap">
                  Trạng thái
                </span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="bg-transparent border-none text-[11px] font-black text-deep-teal focus:ring-0 cursor-pointer p-0 pr-6"
                >
                  <option value="all">Tất cả</option>
                  <option value="Chờ xác nhận">Chờ xác nhận</option>
                  <option value="Đợi gửi">Đợi gửi</option>
                  <option value="Đang giao">Đang giao</option>
                  <option value="Thành công">Thành công</option>
                  <option value="Chăm sóc">Chăm sóc</option>
                  <option value="HD sử dụng">HD sử dụng</option>
                  <option value="Xử lý">Xử lý</option>
                  <option value="Đơn BOM 💣">BOM</option>
                  <option value="Hoàn hàng">Hoàn hàng</option>
                  <option value="Đã Hủy">Hủy</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-1.5 rounded-xl border border-deep-teal/5 shrink-0">
                <span className="text-[9px] font-black text-deep-teal/40 uppercase tracking-widest whitespace-nowrap">
                  Công nợ
                </span>
                <select
                  value={filterPaymentStatus}
                  onChange={(e) =>
                    setFilterPaymentStatus(e.target.value as any)
                  }
                  className="bg-transparent border-none text-[11px] font-black text-deep-teal focus:ring-0 cursor-pointer p-0 pr-6"
                >
                  <option value="all">Tất cả</option>
                  <option value="paid">Đã thanh toán (Đủ)</option>
                  <option value="partial">Thanh toán một phần (Còn nợ)</option>
                  <option value="unpaid">Chưa thanh toán</option>
                </select>
              </div>

              <div className="contents">
                <div className="flex flex-nowrap items-center gap-2 bg-sky-50/50 px-3 py-1.5 rounded-xl border border-deep-teal/5 shrink-0">
                  <span className="text-[9px] font-black text-deep-teal/40 uppercase tracking-widest whitespace-nowrap min-w-[50px]">
                    Ngày đặt
                  </span>
                  <select
                    className="bg-transparent border-none text-[10px] font-black text-deep-teal outline-none cursor-pointer py-0 px-1"
                    value={filterOrderDatePreset}
                    onChange={(e) => handleOrderPresetChange(e.target.value)}
                  >
                    <option value="today">Hôm nay</option>
                    <option value="7days">7 ngày trước</option>
                    <option value="15days">15 ngày trước</option>
                    <option value="30days">30 ngày trước</option>
                    <option value="thisMonth">Tháng này</option>
                    <option value="lastMonth">Tháng trước</option>
                    <option value="custom">Tự chọn</option>
                    <option value="all">Tất cả</option>
                  </select>
                  {filterOrderDatePreset === "custom" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="bg-transparent border-none text-[10px] font-black text-deep-teal outline-none cursor-pointer p-0"
                        value={filterOrderStartDate}
                        onChange={(e) => {
                          setFilterOrderStartDate(e.target.value);
                        }}
                      />
                      <span className="text-deep-teal/40 text-[10px] font-black">
                        -
                      </span>
                      <input
                        type="date"
                        className="bg-transparent border-none text-[10px] font-black text-deep-teal outline-none cursor-pointer p-0"
                        value={filterOrderEndDate}
                        onChange={(e) => {
                          setFilterOrderEndDate(e.target.value);
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-nowrap items-center gap-2 bg-sky-50/50 px-3 py-1.5 rounded-xl border border-deep-teal/5 shrink-0">
                  <span className="text-[9px] font-black text-deep-teal/40 uppercase tracking-widest whitespace-nowrap min-w-[50px]">
                    Ngày gửi
                  </span>
                  <select
                    className="bg-transparent border-none text-[10px] font-black text-deep-teal outline-none cursor-pointer py-0 px-1"
                    value={filterShipDatePreset}
                    onChange={(e) => handleShipPresetChange(e.target.value)}
                  >
                    <option value="today">Hôm nay</option>
                    <option value="7days">7 ngày trước</option>
                    <option value="15days">15 ngày trước</option>
                    <option value="30days">30 ngày trước</option>
                    <option value="thisMonth">Tháng này</option>
                    <option value="lastMonth">Tháng trước</option>
                    <option value="custom">Tự chọn</option>
                    <option value="all">Tất cả</option>
                  </select>
                  {filterShipDatePreset === "custom" && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="bg-transparent border-none text-[10px] font-black text-deep-teal outline-none cursor-pointer p-0"
                        value={filterShipStartDate}
                        onChange={(e) => {
                          setFilterShipStartDate(e.target.value);
                        }}
                      />
                      <span className="text-deep-teal/40 text-[10px] font-black">
                        -
                      </span>
                      <input
                        type="date"
                        className="bg-transparent border-none text-[10px] font-black text-deep-teal outline-none cursor-pointer p-0"
                        value={filterShipEndDate}
                        onChange={(e) => {
                          setFilterShipEndDate(e.target.value);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto min-h-[400px] hide-scrollbar">
          <table className="w-full min-w-[1000px] text-left">
            <thead>
              <tr className="text-deep-teal/70 text-[11px] uppercase font-bold tracking-wider border-b border-deep-teal/10">
                <th className="pb-6 px-4">Thông tin khách</th>
                <th className="pb-6 px-4">Sản phẩm</th>
                <th className="pb-6 px-4 text-center">Giao hàng</th>
                <th className="pb-6 px-4 text-center">T.Toán</th>
                <th className="pb-6 px-4 text-center">Trạng thái</th>
                <th className="pb-6 px-4 text-right">Tổng thu</th>
                <th className="pb-6 px-4 text-center">Lệnh</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredOrders.map((order, i) => (
                <React.Fragment key={order.id}>
                  <tr
                    className="group hover:bg-sky-50 transition-colors border-t border-deep-teal/5 first:border-0 even:bg-slate-50/50 relative"
                    style={{ zIndex: 1000 - i }}
                  >
                    <td className="py-5 px-4">
                      <div className="flex items-start gap-2">
                        <div>
                          <span className="font-black text-deep-teal text-[15px] block leading-tight">
                            {order.customerName}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={cn(
                                "text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest",
                                order.customerType === "ttd"
                                  ? "bg-purple-100 text-purple-600"
                                  : "bg-blue-100 text-blue-600",
                              )}
                            >
                              {order.customerType === "ttd" ? "TTD" : "Mới"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-deep-teal/60 font-bold">
                                {order.customerPhone}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(order);
                                }}
                                className="text-amber-500 hover:text-amber-600 transition-colors p-1 rounded-md hover:bg-amber-50/50"
                                title="Sao chép thông tin"
                              >
                                <Copy size={12} strokeWidth={2.5} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="max-w-[220px] truncate text-[13px] text-deep-teal/80 font-medium leading-relaxed">
                        {order.products
                          .map((p) => `${p.name} (x${p.qty})`)
                          .join(", ")}
                      </div>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "text-[12px] font-bold flex items-center gap-1.5 transition-all duration-300",
                            order.status === "Đợi gửi"
                              ? "text-coral drop-shadow-[0_2px_8px_rgba(238,100,87,0.6)]"
                              : "text-deep-teal/70",
                          )}
                        >
                          <Truck
                            size={14}
                            className={
                              order.status === "Đợi gửi"
                                ? "text-coral"
                                : "text-deep-teal/60"
                            }
                          />
                          {order.shipDate.split("-").reverse().join("/")}
                        </span>
                      </div>
                    </td>
                    <td className="py-5 px-4 text-center font-bold text-deep-teal/80 text-xs tracking-tighter">
                      {order.payMethod.split(" ")[0]}
                    </td>
                    <td className="py-5 px-4 text-center">
                      <OrderStatusDropdown
                        value={order.status || "Đợi gửi"}
                        onChange={(newStatus) =>
                          changeStatus(order.id, newStatus)
                        }
                      />
                    </td>
                    <td className="py-5 px-4 text-right font-black text-[15px] text-deep-teal">
                      <div>{formatMoney(order.total)}</div>
                      {!order.isPaid &&
                        order.paidAmount !== undefined &&
                        order.paidAmount > 0 &&
                        order.paidAmount < order.total && (
                          <div className="text-[10px] text-coral mt-1 uppercase font-bold text-nowrap">
                            Nợ: {formatMoney(order.total - order.paidAmount)}
                          </div>
                        )}
                      {!order.isPaid &&
                        (!order.paidAmount || order.paidAmount === 0) && (
                          <div className="text-[10px] text-amber-600 mt-1 uppercase font-bold text-nowrap">
                            Nợ đủ: {formatMoney(order.total)}
                          </div>
                        )}
                    </td>
                    <td
                      className="py-5 px-4 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-center gap-2 md:gap-3 opacity-100 lg:opacity-60 lg:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            togglePaid(order.id, order.isPaid, order.total)
                          }
                          className="group flex shrink-0 items-center justify-center w-9 h-9 relative"
                          title={
                            order.isPaid
                              ? "Đã thanh toán (Đủ)"
                              : order.paidAmount && order.paidAmount > 0
                                ? "Thanh toán một phần"
                                : "Chưa thanh toán"
                          }
                        >
                          <div
                            className={cn(
                              "w-[22px] h-[22px] rounded-md border-2 flex items-center justify-center transition-all duration-200 shadow-sm outline-none shrink-0",
                              order.isPaid
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : order.paidAmount && order.paidAmount > 0
                                  ? "bg-amber-400 border-amber-400 text-white"
                                  : "bg-white border-slate-300 group-hover:border-emerald-400 text-transparent",
                            )}
                          >
                            {order.paidAmount &&
                            order.paidAmount > 0 &&
                            order.paidAmount < order.total ? (
                              <span className="text-[10px] font-black">!</span>
                            ) : (
                              <Check size={14} strokeWidth={4} />
                            )}
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewInvoiceOrder(order);
                          }}
                          className="w-9 h-9 shrink-0 rounded-xl bg-white border border-sky-100 shadow-sm text-purple-400 hover:text-purple-600 hover:bg-purple-50 flex items-center justify-center transition-all"
                          title="Xem hóa đơn"
                        >
                          <Receipt size={18} />
                        </button>
                        <button
                          onClick={() => handleEdit(order)}
                          className="w-9 h-9 shrink-0 rounded-xl bg-white border border-sky-100 shadow-sm text-deep-teal/60 hover:text-deep-teal flex items-center justify-center transition-all"
                        >
                          <PenSquare size={18} />
                        </button>
                        <button
                          onClick={() => setOrderToDelete(order)}
                          className="w-9 h-9 shrink-0 rounded-xl bg-white border border-sky-100 shadow-sm text-red-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden mt-4 space-y-3 pb-24 mx-[-16px] px-4 relative">
          {filteredOrders.map((order, i) => {
            const getColors = (status: string) => {
              switch (status) {
                case "Đợi gửi":
                  return {
                    bg: "bg-gradient-to-br from-amber-50/80 to-white",
                    border: "border-amber-200/60",
                    decor: "bg-amber-100/50",
                    name: "text-amber-900",
                    divider: "border-amber-100/60",
                    bgInner: "bg-amber-50/50 border-amber-100/50",
                  };
                case "Đang giao":
                  return {
                    bg: "bg-gradient-to-br from-purple-50/80 to-white",
                    border: "border-purple-200/60",
                    decor: "bg-purple-100/50",
                    name: "text-purple-900",
                    divider: "border-purple-100/60",
                    bgInner: "bg-purple-50/50 border-purple-100/50",
                  };
                case "Thành công":
                  return {
                    bg: "bg-gradient-to-br from-emerald-50/80 to-white",
                    border: "border-emerald-200/60",
                    decor: "bg-emerald-100/50",
                    name: "text-emerald-900",
                    divider: "border-emerald-100/60",
                    bgInner: "bg-emerald-50/50 border-emerald-100/50",
                  };
                case "Hoàn hàng":
                  return {
                    bg: "bg-gradient-to-br from-orange-50/80 to-white",
                    border: "border-orange-200/60",
                    decor: "bg-orange-100/50",
                    name: "text-orange-900",
                    divider: "border-orange-100/60",
                    bgInner: "bg-orange-50/50 border-orange-100/50",
                  };
                case "Đơn BOM 💣":
                  return {
                    bg: "bg-gradient-to-br from-red-50/80 to-white",
                    border: "border-red-200/60",
                    decor: "bg-red-100/50",
                    name: "text-red-900",
                    divider: "border-red-100/60",
                    bgInner: "bg-red-50/50 border-red-100/50",
                  };
                case "Chăm sóc":
                  return {
                    bg: "bg-gradient-to-br from-pink-50/80 to-white",
                    border: "border-pink-200/60",
                    decor: "bg-pink-100/50",
                    name: "text-pink-900",
                    divider: "border-pink-100/60",
                    bgInner: "bg-pink-50/50 border-pink-100/50",
                  };
                case "Chờ xác nhận":
                  return {
                    bg: "bg-gradient-to-br from-sky-50/80 to-white",
                    border: "border-sky-200/60",
                    decor: "bg-sky-100/50",
                    name: "text-sky-900",
                    divider: "border-sky-100/60",
                    bgInner: "bg-sky-50/50 border-sky-100/50",
                  };
                default:
                  return {
                    bg: "bg-white",
                    border: "border-slate-200/60",
                    decor: "bg-slate-50/50",
                    name: "text-slate-800",
                    divider: "border-slate-100/80",
                    bgInner: "bg-slate-50 border-slate-100/50",
                  };
              }
            };
            const colors = getColors(order.status || "Đợi gửi");

            return (
              <div
                key={order.id}
                className={`rounded-[16px] p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] border flex flex-col gap-3 relative overflow-hidden transition-all ${colors.bg} ${colors.border}`}
                style={{ zIndex: 1000 - i }}
              >
                {/* Decorative faint background element */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] pointer-events-none -z-10 ${colors.decor}`}
                />

                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-black text-[16px] leading-tight mb-1.5 truncate ${colors.name}`}
                    >
                      {order.customerName}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest shrink-0",
                          order.customerType === "ttd"
                            ? "bg-purple-100 text-purple-600"
                            : "bg-blue-100 text-blue-600",
                        )}
                      >
                        {order.customerType === "ttd" ? "TTD" : "Mới"}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[11px] font-bold text-slate-600 truncate">
                          {order.customerPhone}
                        </span>
                        <button
                          onClick={() => handleCopy(order)}
                          className="text-slate-400 bg-white shadow-sm border border-slate-200 rounded p-1 shrink-0 hover:bg-slate-50"
                          title="Sao chép thông tin"
                        >
                          <Copy size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 max-w-[120px]">
                    <OrderStatusDropdown
                      value={order.status || "Đợi gửi"}
                      onChange={(newStatus) =>
                        changeStatus(order.id, newStatus)
                      }
                    />
                  </div>
                </div>

                <div
                  className={`rounded-xl p-3 space-y-2 border ${colors.bgInner}`}
                >
                  <div
                    className={`text-[13px] font-medium leading-relaxed ${colors.name}`}
                  >
                    {order.products
                      .map((p) => `${p.name} (x${p.qty})`)
                      .join(", ")}
                  </div>
                  <div
                    className={`flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium mt-2 pt-2 border-t ${colors.divider}`}
                  >
                    <div className="flex items-center gap-1.5 bg-white/80 px-2 py-0.5 rounded shadow-sm border border-slate-200/50">
                      <Truck
                        size={12}
                        className={
                          order.status === "Đợi gửi"
                            ? "text-coral"
                            : "text-slate-400"
                        }
                      />
                      <span
                        className={cn(
                          "font-bold",
                          order.status === "Đợi gửi"
                            ? "text-coral drop-shadow-[0_2px_8px_rgba(238,100,87,0.6)]"
                            : "",
                        )}
                      >
                        {order.shipDate.split("-").reverse().join("/")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/80 px-2 py-0.5 rounded shadow-sm border border-slate-200/50 font-bold text-slate-600">
                      <CreditCard size={12} className="text-slate-400" />
                      {order.payMethod.split(" ")[0]}
                    </div>
                  </div>
                </div>

                <div
                  className={`flex justify-between items-end pt-2 border-t mt-1 ${colors.divider}`}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                      Tổng thu
                    </span>
                    <span
                      className={`font-black text-[16px] leading-none ${colors.name}`}
                    >
                      {formatMoney(order.total)}
                    </span>
                    {!order.isPaid &&
                      order.paidAmount !== undefined &&
                      order.paidAmount > 0 &&
                      order.paidAmount < order.total && (
                        <div className="text-[10px] text-coral mt-1 uppercase font-bold">
                          Nợ: {formatMoney(order.total - order.paidAmount)}
                        </div>
                      )}
                    {!order.isPaid &&
                      (!order.paidAmount || order.paidAmount === 0) && (
                        <div className="text-[10px] text-amber-600 mt-1 uppercase font-bold">
                          Nợ đủ: {formatMoney(order.total)}
                        </div>
                      )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        togglePaid(order.id, order.isPaid, order.total)
                      }
                      className="flex shrink-0 items-center justify-center w-8 h-8 relative"
                    >
                      <div
                        className={cn(
                          "w-[20px] h-[20px] rounded-md border-2 flex items-center justify-center transition-all duration-200 shadow-sm outline-none shrink-0 bg-white",
                          order.isPaid
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : order.paidAmount && order.paidAmount > 0
                              ? "bg-amber-400 border-amber-400 text-white"
                              : "border-slate-300 text-transparent",
                        )}
                      >
                        {order.paidAmount &&
                        order.paidAmount > 0 &&
                        order.paidAmount < order.total ? (
                          <span className="text-[10px] font-black">!</span>
                        ) : (
                          <Check size={12} strokeWidth={4} />
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => setViewInvoiceOrder(order)}
                      className="w-8 h-8 shrink-0 rounded-lg bg-white/60 hover:bg-purple-50 text-purple-500 flex items-center justify-center shadow-sm border border-purple-100/50 transition-colors"
                    >
                      <Receipt size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(order)}
                      className="w-8 h-8 shrink-0 rounded-lg bg-white/60 hover:bg-sky-50 text-sky-600 flex items-center justify-center shadow-sm border border-sky-100/50 transition-colors"
                    >
                      <PenSquare size={14} />
                    </button>
                    <button
                      onClick={() => setOrderToDelete(order)}
                      className="w-8 h-8 shrink-0 rounded-lg bg-white/60 hover:bg-red-50 text-red-500 flex items-center justify-center shadow-sm border border-red-100/50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {orders.length >= displayedCount && (
          <div className="flex justify-center p-6 border-t border-deep-teal/5">
            <button
              id="load-more-btn"
              onClick={() => setDisplayedCount((prev) => prev + ITEMS_PER_PAGE)}
              className="px-6 py-2 bg-sky-50 text-sky-600 rounded-full font-black text-xs uppercase tracking-widest hover:bg-sky-100 transition-colors border border-sky-200 shadow-sm"
            >
              Tải thêm 20 đơn
            </button>
          </div>
        )}
      </section>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-deep-teal/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-sky-100"
            >
              <h3 className="text-xl font-black text-deep-teal mb-6">
                Xuất Excel Đơn Hàng
              </h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                    Tên file
                  </label>
                  <input
                    type="text"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    className="w-full bg-sky-50 rounded-2xl px-4 py-3 text-sm font-bold text-deep-teal border-transparent focus:border-coral outline-none transition-all placeholder:text-deep-teal/20"
                    placeholder="Tên file không cần đuôi .xlsx"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                    Từ ngày (Ngày tạo)
                  </label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full bg-sky-50 rounded-2xl px-4 py-3 text-sm font-bold text-deep-teal border-transparent focus:border-coral outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                    Đến ngày (Ngày tạo)
                  </label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full bg-sky-50 rounded-2xl px-4 py-3 text-sm font-bold text-deep-teal border-transparent focus:border-coral outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setIsExportModalOpen(false)}
                  className="flex-1 py-3.5 bg-sky-50 text-deep-teal hover:bg-sky-100 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex-1 py-3.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <FileDown size={16} /> Xuất
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteAllModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteAllModalOpen(false)}
              className="absolute inset-0 bg-deep-teal/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-sky-100 text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl font-black text-deep-teal mb-3">
                Xóa tất cả đơn hàng?
              </h3>
              <p className="text-sm text-deep-teal/60 font-medium mb-8 leading-relaxed">
                Bạn có chắc chắn muốn xóa toàn bộ{" "}
                <span className="font-bold text-red-500">{orders.length}</span>{" "}
                đơn hàng?
                <br />
                Hành động này không thể hoàn tác và sẽ hoàn trả các sản phẩm vào
                kho.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteAllModalOpen(false)}
                  className="flex-1 py-4 bg-sky-50 text-deep-teal font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-sky-100 transition-all border border-sky-100"
                >
                  Hủy
                </button>
                <button
                  onClick={deleteAllOrders}
                  className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-200"
                >
                  Xóa tất cả
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {orderToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOrderToDelete(null)}
              className="absolute inset-0 bg-deep-teal/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[32px] p-6 lg:p-8 max-w-md w-full shadow-2xl border border-sky-100 text-center"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50/80 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100">
                <Trash2 size={28} className="text-red-500" />
              </div>
              <h3 className="text-xl font-black text-deep-teal mb-2">
                Xóa đơn hàng?
              </h3>
              <div className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">
                Bạn đang chuẩn bị xóa đơn hàng của{" "}
                <span className="font-bold text-deep-teal">
                  {orderToDelete.customerName}
                </span>
                .
                <div className="mt-3 bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 text-left">
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      Hành động này{" "}
                      <span className="font-bold">không thể hoàn tác</span>.
                    </li>
                    <li>
                      <span className="font-bold">
                        {orderToDelete.products.reduce(
                          (acc, p) => acc + p.qty,
                          0,
                        )}
                      </span>{" "}
                      sản phẩm sẽ được tự động hoàn trả lại vào kho.
                    </li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setOrderToDelete(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-600 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Hủy
                </button>
                <button
                  onClick={() => deleteOrder(orderToDelete)}
                  className="flex-1 py-4 bg-red-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-[0_8px_20px_rgb(239,68,68,0.2)]"
                >
                  Xác nhận Xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <InvoicePreviewModal
        order={viewInvoiceOrder}
        onClose={() => setViewInvoiceOrder(null)}
      />
    </div>
  );
};
