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
import { exportInvoice, printInvoice } from "../lib/invoice";
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
  FileSpreadsheet
} from "lucide-react";

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

export const OrderForm = ({ orderToEdit, onFinish }: { orderToEdit?: any, onFinish: () => void }) => {
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

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState(`DanhSachDonHang_${new Date().toISOString().split("T")[0]}`);
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
          return date >= new Date(exportStartDate + "T00:00:00") && date <= new Date(exportEndDate + "T23:59:59");
        });
      } else if (exportStartDate) {
        dataToExport = dataToExport.filter((o) => new Date(o.orderDate) >= new Date(exportStartDate + "T00:00:00"));
      } else if (exportEndDate) {
        dataToExport = dataToExport.filter((o) => new Date(o.orderDate) <= new Date(exportEndDate + "T23:59:59"));
      }

      const data = dataToExport.map(o => ({
        "Mã ĐH": o.id,
        "Khách hàng": o.customerName,
        "Số điện thoại": o.customerPhone,
        "Địa chỉ": o.customerAddr,
        "Ngày tạo": o.orderDate,
        "Ngày nhận": o.shipDate,
        "Trạng thái": o.status,
        "Hình thức TT": o.payMethod,
        "Sản phẩm": o.products.map(p => `${p.name} (x${p.qty})`).join(", "),
        "Tổng tiền": o.total
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
        const customerName = String(row["Khách hàng"] || row["Tên khách hàng"] || "").trim();
        
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
          products: products.length > 0 ? products : [{ name: "Sản phẩm nhập từ Excel", price: total, qty: 1 }],
          payMethod: String(row["Hình thức TT"] || "COD (Shipper)") as PayMethod,
          shipFee: 0,
          discount: { val: 0, type: "amount" as DiscountType },
          orderDate: String(row["Ngày tạo"] || new Date().toISOString().split("T")[0]),
          shipDate: String(row["Ngày nhận"] || new Date().toISOString().split("T")[0]),
          deliveryDate: String(row["Ngày nhận"] || new Date().toISOString().split("T")[0]),
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
  const [paidAmount, setPaidAmount] = useState("0");

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
    const q = query(getTenantCollection("customers", user), orderBy("name", "asc"));
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
    const q = query(getTenantCollection("inventory", user), orderBy("name", "asc"));
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
        allCustomers.filter((c) => c.phone.includes(val) || removeVietnameseTones(c.name || '').toLowerCase().includes(lowerVal)).slice(0, 5),
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
          .filter((c) => removeVietnameseTones(c.name || '').toLowerCase().includes(lowerVal) || c.phone.includes(val))
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
          .filter((p) => removeVietnameseTones(p.name || '').toLowerCase().includes(lowerVal))
          .slice(0, 5),
      );
    }
  };

  const selectProduct = (p: InventoryItem, index: number) => {
    const newProducts = [...products];
    newProducts[index] = { ...newProducts[index], name: p.name, price: p.price };
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
    const q = query(getTenantCollection("orders", user), orderBy("createdAt", "desc"), limit(displayedCount));
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
      { threshold: 0.1 }
    );

    const btn = document.getElementById("load-more-btn");
    if (btn) {
      observer.observe(btn);
    }

    return () => observer.disconnect();
  }, [orders.length, displayedCount]);

  
  useEffect(() => {
    if (orderToEdit) {
      setEditingId(orderToEdit.id);
      setCustPhone(orderToEdit.customerPhone || "");
      setCustName(orderToEdit.customerName || "");
      setCustAddr(orderToEdit.customerAddr || "");
      setCustType(orderToEdit.customerType || "new");
      setProducts(orderToEdit.products && orderToEdit.products.length > 0 ? orderToEdit.products : [{ name: "", qty: 1, price: 0 }]);
      setPayMethod(orderToEdit.payMethod || "COD (Shipper)");
      setOrderDate(orderToEdit.orderDate || new Date().toISOString().split("T")[0]);
      setShipDate(orderToEdit.shipDate || new Date().toISOString().split("T")[0]);
      setDeliveryDate(orderToEdit.deliveryDate || "");
      setOrderNote(orderToEdit.note || "");
      setShipFee(String(orderToEdit.shipFee || 0));
      setDiscountVal(String(orderToEdit.discount?.val || 0));
      setDiscountType(orderToEdit.discount?.type || "amount");
      if (orderToEdit.paidAmount !== undefined) {
        setPaidAmount(String(orderToEdit.paidAmount));
      } else {
        setPaidAmount(orderToEdit.isPaid ? String(orderToEdit.total || 0) : "0");
      }
    } else {
      resetForm();
    }
  }, [orderToEdit]);

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
    setPaidAmount("0");
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
    const parsedPaidAmount = parseCurrency(paidAmount);
    const orderData: any = {
      customerName: custName,
      customerPhone: custPhone,
      customerAddr: custAddr,
      customerType: custType,
      products: products.filter((p) => p.name && p.price >= 0),
      payMethod,
      shipFee: parseCurrency(shipFee),
      discount: { val: parseCurrency(discountVal), type: discountType },
      paidAmount: parsedPaidAmount,
      isPaid: parsedPaidAmount >= total && total > 0,
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
        batch.set(orderRef, {
          status: "Đợi gửi",
          createdAt: serverTimestamp(),
          ...orderData,
        }, { merge: true });
      }

      // 2. Customer
      const custRef = getTenantDoc("customers", custPhone, user);
      const isNewCustomer = !allCustomers.find(c => c.phone === custPhone);
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

      batch.set(
        custRef,
        custData,
        { merge: true },
      );

      // 3. Inventory
      orderData.products.forEach((p: Product) => {
        const invMatch = allInventory.find(
          (item) => (item.name || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase(),
        );
        if (invMatch) {
          if (!editingId) {
            const invDoc = getTenantDoc("inventory", invMatch.id, user);
            batch.update(invDoc, { qty: increment(-p.qty) });
          }
        } else {
          const newInvRef = doc(getTenantCollection("inventory", user));
          batch.set(newInvRef, {
            name: p.name,
            price: p.price,
            qty: editingId ? 0 : -p.qty,
            type: detectInventoryType(p.name),
            createdAt: serverTimestamp(),
          }, { merge: true });
        }
      });

      await batch.commit();
      resetForm();
      showToast(
        editingId ? "Đã cập nhật đơn hàng!" : "Đã lưu đơn hàng thành công!",
      );
      onFinish();
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
          (item) => (item.name || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase(),
        );
        if (invMatch) {
          const invDoc = getTenantDoc("inventory", invMatch.id, user);
          batch.update(invDoc, { qty: increment(p.qty) });
        }
      });

      // 2. Adjust Customer total spent
      if (order.customerPhone) {
        const custRef = getTenantDoc("customers", order.customerPhone, user);
        batch.set(custRef, {
          name: (order.customerName || "Khách hàng").substring(0, 100),
          phone: order.customerPhone.substring(0, 20),
          totalSpent: increment(-(Number(order.total) || 0)),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // 3. Delete Order
      batch.delete(getTenantDoc("orders", order.id, user));

      await batch.commit();
      setOrderToDelete(null);
      showToast("Đã xóa đơn hàng và hoàn kho!");
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `orders/${order.id}`,
      );
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
            (item) => (item.name || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase(),
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
            batch.set(custRef, {
              name: (order.customerName || "Khách hàng").substring(0, 100),
              phone: order.customerPhone.substring(0, 20),
              totalSpent: increment(-(Number(order.total) || 0)),
              updatedAt: serverTimestamp(),
            }, { merge: true });
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

  const togglePaid = async (id: string, current: boolean) => {
    try {
      await updateDoc(getTenantDoc("orders", id, user), {
        isPaid: !current,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const handleEdit = (order: Order) => {
    setEditingId(order.id);
    setCustPhone(order.customerPhone);
    setCustName(order.customerName);
    setCustAddr(order.customerAddr);
    setCustType(order.customerType);
    setProducts(order.products);
    setPayMethod(order.payMethod);
    setOrderDate(order.orderDate);
    setShipDate(order.shipDate);
    setDeliveryDate(order.deliveryDate);
    setOrderNote(order.note);
    setShipFee(new Intl.NumberFormat("en-US").format(order.shipFee));
    setDiscountVal(
      order.discount.type === "amount"
        ? new Intl.NumberFormat("en-US").format(order.discount.val)
        : order.discount.val.toString(),
    );
    setDiscountType(order.discount.type);
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
        removeVietnameseTones(o.customerName || '').toLowerCase().includes(searchNormalized) ||
        o.customerPhone.includes(search);
      const matchCustType =
        filterCustType === "all" || o.customerType === filterCustType;
      const matchPayMethod =
        filterPayMethod === "all" || o.payMethod === filterPayMethod;
      const matchStatus = filterStatus === "all" || o.status === filterStatus;
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
    filterOrderStartDate,
    filterOrderEndDate,
    filterShipStartDate,
    filterShipEndDate,
  ]);

  const { total } = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Order Form */}
      <section className="bg-gradient-to-br from-white/90 via-sky-50/80 to-coral/10 backdrop-blur-3xl border border-white/60 shadow-2xl shadow-deep-teal/10 rounded-[32px] p-6 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-coral/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-deep-teal/20 rounded-full blur-3xl pointer-events-none"></div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveOrder();
          }}
          className="space-y-6 relative z-10"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <label className="text-[10px] font-black text-deep-teal uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
                <User size={14} /> Thông tin khách hàng
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Smartphone
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a2a5a6]"
                  />
                  <input
                    type="text"
                    placeholder="09xx xxx xxx"
                    className="theme-input pl-12 text-[#05344f] font-black placeholder:text-[#a2a5a6] placeholder:text-[11px] placeholder:font-normal"
                    value={custPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onFocus={(e) => handlePhoneChange(e.target.value)}
                    onBlur={() =>
                      setTimeout(() => setActiveSearchField(null), 200)
                    }
                  />
                  {activeSearchField === "phone" &&
                    customerSuggestions.length > 0 && (
                      <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-sky-100 overflow-hidden animate-fade-in">
                        {customerSuggestions.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectCustomer(c);
                            }}
                            className="w-full px-5 py-3 text-left text-xs font-bold text-deep-teal hover:bg-sky-50 transition-colors flex justify-between border-b border-sky-50 last:border-0"
                          >
                            <span>{c.phone}</span>
                            <span className="font-medium text-deep-teal/40 italic">
                              {c.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                <select
                  value={custType}
                  onChange={(e) => setCustType(e.target.value as CustomerType)}
                  className="theme-input w-24 font-black text-xs cursor-pointer text-[#05344f] !px-2"
                >
                  <option value="new">Mới</option>
                  <option value="ttd">TTD</option>
                </select>
              </div>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a2a5a6]"
                />
                <input
                  type="text"
                  placeholder="Họ và tên khách hàng"
                  className="theme-input pl-12 text-[#05344f] font-black placeholder:text-[#a2a5a6] placeholder:text-[11px] placeholder:font-normal"
                  value={custName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onFocus={(e) => handleNameChange(e.target.value)}
                  onBlur={() =>
                    setTimeout(() => setActiveSearchField(null), 200)
                  }
                />
                {activeSearchField === "name" &&
                  customerSuggestions.length > 0 && (
                    <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-sky-100 overflow-hidden animate-fade-in">
                      {customerSuggestions.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectCustomer(c);
                          }}
                          className="w-full px-5 py-3 text-left text-xs font-bold text-deep-teal hover:bg-sky-50 transition-colors flex justify-between border-b border-sky-50 last:border-0"
                        >
                          <span className="font-medium text-deep-teal/40 italic">
                            {c.name}
                          </span>
                          <span className="font-mono text-[10px]">
                            {c.phone}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            <div className="space-y-5">
              <label className="text-[10px] font-black text-deep-teal uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
                <MapPin size={14} /> Địa chỉ giao hàng
              </label>
              <textarea
                placeholder="Số nhà, tên đường, phường/xã..."
                className="theme-input h-[116px] resize-none py-4 text-[#05344f] font-bold placeholder:text-[#a2a5a6] placeholder:text-[11px] placeholder:font-normal"
                value={custAddr}
                onChange={(e) => setCustAddr(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-deep-teal uppercase tracking-[0.2em] flex items-center gap-2 ml-2">
              <ShoppingBag size={14} /> Danh mục sản phẩm
            </label>
            <div className="space-y-3">
              {products.map((p, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-3 items-center bg-white/50 p-2 rounded-2xl border border-white"
                >
                  <div className="col-span-12 md:col-span-6 relative">
                    <input
                      type="text"
                      placeholder="Tìm kiếm sản phẩm..."
                      className="theme-input !py-2.5 h-12 text-[#05344f] font-black placeholder:text-[#a2a5a6] placeholder:text-[11px] placeholder:font-normal"
                      value={p.name || ""}
                      onFocus={(e) =>
                        handleProductSearch(e.target.value, index, true)
                      }
                      onChange={(e) =>
                        handleProductSearch(e.target.value, index)
                      }
                      onBlur={() =>
                        setTimeout(() => setActiveSuggestionRow(null), 200)
                      }
                    />
                    {activeSuggestionRow === index &&
                      productSuggestions.length > 0 && (
                        <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-50 bg-white rounded-2xl shadow-2xl border border-sky-100 overflow-hidden">
                          {productSuggestions.map((ps) => (
                            <button
                              key={ps.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectProduct(ps, index);
                              }}
                              className="w-full px-5 py-3 text-left text-xs font-bold text-deep-teal hover:bg-sky-50 border-b border-sky-50 last:border-0 flex justify-between"
                            >
                              <span>{ps.name}</span>
                              <span className="text-coral font-black">
                                {formatMoney(ps.price)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                  <div className="col-span-6 md:col-span-3">
                    <input
                      type="text"
                      placeholder="Giá lẻ"
                      className="theme-input !py-2.5 h-12 text-center text-[#05344f] font-black placeholder:text-[#a2a5a6] placeholder:text-[11px] placeholder:font-normal"
                      value={
                        p.price
                          ? new Intl.NumberFormat("en-US").format(p.price)
                          : ""
                      }
                      onChange={(e) =>
                        updateProduct(
                          index,
                          "price",
                          parseCurrency(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2 flex bg-white border-sky-200 border-2 rounded-2xl overflow-hidden h-12 shadow-inner">
                    <button
                      type="button"
                      onClick={() =>
                        updateProduct(index, "qty", Math.max(1, p.qty - 1))
                      }
                      className="flex-1 text-[#05344f] font-black hover:text-coral transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      className="w-12 bg-transparent text-center text-sm font-black text-[#05344f] border-none focus:ring-0"
                      value={p.qty ?? 1}
                      onChange={(e) =>
                        updateProduct(
                          index,
                          "qty",
                          parseInt(e.target.value) || 1,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => updateProduct(index, "qty", p.qty + 1)}
                      className="flex-1 text-[#05344f] font-black hover:text-coral transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="col-span-2 md:col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeProductRow(index)}
                      className="text-deep-teal/20 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addProductRow}
              className="w-full py-4 bg-white/50 border-2 border-dashed border-deep-teal/10 rounded-2xl text-deep-teal/40 font-black text-[10px] uppercase tracking-widest hover:bg-white hover:border-deep-teal/20 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> THÊM MẶT HÀNG MỚI
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 pt-6 border-t border-deep-teal/5">
            <div>
              <label className="text-[10px] font-black text-deep-teal uppercase tracking-widest ml-2 mb-1.5 block">
                Ngày đặt
              </label>
              <input
                type="date"
                className="theme-input !py-2 h-11 text-[#05344f] font-bold"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-deep-teal uppercase tracking-widest ml-2 mb-1.5 block">
                Ngày gửi
              </label>
              <input
                type="date"
                className="theme-input !py-2 h-11 text-[#05344f] font-bold"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-deep-teal uppercase tracking-widest ml-2 mb-1.5 block">
                Ngày nhận
              </label>
              <input
                type="date"
                className="theme-input !py-2 h-11 text-[#05344f] font-bold"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-deep-teal uppercase tracking-widest ml-2 mb-1.5 block">
                Thanh toán
              </label>
              <select
                className="theme-input !py-2 h-11 cursor-pointer text-[#05344f] font-bold"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PayMethod)}
              >
                <option>COD (Shipper)</option>
                <option>Chuyển khoản</option>
                <option>Tiền mặt</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-deep-teal uppercase tracking-widest ml-2 mb-1.5 block">
                Ghi chú
              </label>
              <input
                type="text"
                className="theme-input !py-2 h-11 text-[#05344f] font-bold placeholder:text-[#a2a5a6] placeholder:text-[11px] placeholder:font-normal"
                placeholder="..."
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-deep-teal rounded-[32px] shadow-2xl relative overflow-hidden p-5 md:p-8">
            <div className="flex flex-col xl:flex-row items-center gap-6 xl:gap-8 relative z-10 justify-between w-full">
              {/* Inputs Group */}
              <div className="w-full flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 xl:max-w-[550px]">
                <div className="space-y-1.5">
                  <label className="text-[10px] block text-white/40 uppercase font-black tracking-widest ml-1">
                    Phí vận chuyển
                  </label>
                  <input
                    type="text"
                    className="bg-white/10 border-none rounded-2xl w-full text-white h-12 px-4 focus:ring-2 focus:ring-coral font-bold transition-all placeholder:text-white/20 text-sm md:text-base"
                    placeholder="0"
                    value={shipFee}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const cleaned = val ? parseInt(val, 10).toString() : "";
                      setShipFee(formatCurrencyInput(cleaned));
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] block text-white/40 uppercase font-black tracking-widest ml-1">
                    Khuyến mãi
                  </label>
                  <div className="relative h-12">
                    <input
                      type="text"
                      className="bg-white/10 border-none rounded-2xl w-full h-full text-white pl-4 pr-[70px] md:pr-20 focus:ring-2 focus:ring-coral outline-none font-bold transition-all placeholder:text-white/20 text-sm md:text-base"
                      placeholder="0"
                      value={discountVal}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        const cleaned = val ? parseInt(val, 10).toString() : "";
                        setDiscountVal(
                          discountType === "amount"
                            ? formatCurrencyInput(cleaned)
                            : cleaned,
                        );
                      }}
                    />
                    <div className="absolute right-1 top-1 bottom-1 flex bg-white/5 rounded-xl p-0.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("percent");
                          const digits = discountVal.replace(/\D/g, "");
                          setDiscountVal(digits);
                        }}
                        className={cn(
                          "w-[30px] md:w-8 h-full rounded-lg text-[9px] font-black transition-all outline-none leading-none flex items-center justify-center",
                          discountType === "percent"
                            ? "bg-coral text-white shadow-lg"
                            : "text-white/30 hover:text-white/50",
                        )}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("amount");
                          const digits = discountVal.replace(/\D/g, "");
                          setDiscountVal(formatCurrencyInput(digits));
                        }}
                        className={cn(
                          "w-[30px] md:w-8 h-full rounded-lg text-[9px] font-black transition-all outline-none leading-none flex items-center justify-center",
                          discountType === "amount"
                            ? "bg-coral text-white shadow-lg"
                            : "text-white/30 hover:text-white/50",
                        )}
                      >
                        ₫
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] block text-white/40 uppercase font-black tracking-widest ml-1">
                    KHÁCH ĐÃ TT
                  </label>
                  <input
                    type="text"
                    className="bg-white/10 border-none rounded-2xl w-full text-white h-12 px-4 focus:ring-2 focus:ring-coral font-bold transition-all placeholder:text-white/20 text-sm md:text-base"
                    placeholder="0"
                    value={paidAmount}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      const cleaned = val ? parseInt(val, 10).toString() : "";
                      setPaidAmount(formatCurrencyInput(cleaned));
                    }}
                  />
                </div>
              </div>

              {/* Mobile Divider */}
              <div className="h-px bg-white/10 w-full xl:hidden" />

              {/* Right Side / Total & Actions */}
              <div className="flex flex-col md:flex-row items-center gap-6 xl:gap-8 w-full xl:w-auto shrink-0 justify-between xl:justify-end">
                {/* Total Group */}
                <div className="flex flex-row md:flex-col justify-between md:justify-center items-center text-right md:text-center w-full md:w-auto shrink-0">
                  <span className="text-[10px] text-white/30 uppercase font-black tracking-[0.3em] md:mb-1">
                    TỔNG THANH TOÁN
                  </span>
                  <div className="text-2xl md:text-3xl lg:text-4xl font-black text-white leading-none">
                    {formatMoney(total)}
                  </div>
                </div>

                {/* Actions Group */}
                <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="w-14 bg-white/10 rounded-2xl text-white hover:bg-white/20 transition-all flex items-center justify-center transform active:scale-95 shadow-lg h-14 shrink-0"
                    title="Làm mới form"
                  >
                    <RotateCcw size={22} />
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className={cn(
                      "flex-1 md:flex-none px-6 lg:px-10 bg-coral text-white rounded-2xl font-black uppercase text-sm shadow-xl hover:shadow-2xl transition-all h-14 active:scale-95 disabled:opacity-50 disabled:scale-100 whitespace-nowrap",
                      isSaving && "cursor-not-allowed",
                    )}
                  >
                    {isSaving
                      ? "Đang lưu..."
                      : editingId
                        ? "Cập nhật"
                        : "XUẤT ĐƠN HÀNG"}
                  </button>
                </div>
              </div>
            </div>
            {/* Subtle background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-coral/10 rounded-full -ml-12 -mb-12 blur-xl pointer-events-none"></div>
          </div>
        </form>
      </section>

      </div>
  );
};
