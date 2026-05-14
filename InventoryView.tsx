import { getTenantCollection, getTenantDoc } from "../lib/tenant";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
} from "firebase/firestore";
import { InventoryItem, InventoryType } from "../types";
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
import {
  Plus,
  Trash2,
  X,
  Warehouse,
  Package,
  DollarSign,
  ListFilter,
  AlertTriangle,
  Box,
} from "lucide-react";

export const InventoryView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockFilter, setStockFilter] = useState<"all" | "low">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "vnl" | "external">("all");
  const [sortBy, setSortBy] = useState<
    "name_asc" | "qty_asc" | "qty_desc" | "price_asc" | "price_desc"
  >("name_asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const ITEMS_PER_PAGE = 20;
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [stockFilter, categoryFilter, searchQuery, sortBy]);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [qty, setQty] = useState("");
  const [type, setType] = useState<InventoryType>("vnl");

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const q = query(
      getTenantCollection("inventory", user),
      orderBy("name", "asc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setItems(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as InventoryItem,
          ),
        );
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "inventory"),
    );
    return unsubscribe;
  }, [user]);

  const addProduct = async () => {
    if (isSaving) return;
    if (!name || !price || !qty) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    setIsSaving(true);
    try {
      await addDoc(getTenantCollection("inventory", user), {
        name,
        price: parseCurrency(price),
        costPrice: parseCurrency(costPrice),
        qty: parseInt(qty) || 0,
        type,
        createdAt: serverTimestamp(),
      });
      setName("");
      setPrice("");
      setCostPrice("");
      setQty("");
      setType("vnl");
      setIcon("");
      setShowAddForm(false);
      showToast("Đã nhập hàng vào kho!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "inventory");
    } finally {
      setIsSaving(false);
    }
  };

  const updateProduct = async (
    id: string,
    field: keyof InventoryItem,
    value: any,
  ) => {
    try {
      const updates: any = { [field]: value };
      if (field === "name" && typeof value === "string") {
        updates.type = detectInventoryType(value);
      }
      await updateDoc(getTenantDoc("inventory", id, user), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const deleteProduct = async (item: InventoryItem) => {
    try {
      await deleteDoc(getTenantDoc("inventory", item.id, user));
      setConfirmingDeleteId(null);
      showToast("Đã xóa sản phẩm khỏi kho!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `inventory/${item.id}`);
    }
  };

  const sortedItems = React.useMemo(() => {
    const searchNormalized = removeVietnameseTones(searchQuery.toLowerCase());
    let result = items.filter((item) => {
      const matchStock = stockFilter === "all" || (item.qty || 0) <= 5;
      const matchCategory =
        categoryFilter === "all" || item.type === categoryFilter;
      const matchSearch = removeVietnameseTones(item.name || "")
        .toLowerCase()
        .includes(searchNormalized);
      return matchStock && matchCategory && matchSearch;
    });

    result.sort((a, b) => {
      if (sortBy === "name_asc") {
        return (a.name || "").localeCompare(b.name || "");
      } else if (sortBy === "qty_asc") {
        return (a.qty || 0) - (b.qty || 0);
      } else if (sortBy === "qty_desc") {
        return (b.qty || 0) - (a.qty || 0);
      } else if (sortBy === "price_asc") {
        return (a.price || 0) - (b.price || 0);
      } else if (sortBy === "price_desc") {
        return (b.price || 0) - (a.price || 0);
      }
      return 0;
    });

    return result;
  }, [items, stockFilter, categoryFilter, searchQuery, sortBy]);

  const visibleItems = sortedItems.slice(0, displayedCount);

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in pb-20 md:pb-0">
      {/* Search & Filters Bar */}
      <div className="flex flex-col gap-4 relative z-[100]">
        {/* Top Row: Search and Add Button */}
        <div className="flex flex-col md:flex-row gap-3 items-center w-full">
          <div className="relative w-full flex-1">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Package className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm trong kho..."
              className="theme-input w-full h-14 pl-12 pr-5 bg-white backdrop-blur-md border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] rounded-[20px] text-[15px] font-semibold text-slate-700 focus:ring-2 focus:ring-deep-teal/20 focus:border-deep-teal/30 focus:outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="relative shrink-0 w-full md:w-auto z-[99999]">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full justify-center flex items-center gap-2 px-6 h-14 bg-deep-teal text-white rounded-[20px] text-[13px] font-bold tracking-wide transition-all shadow-[0_8px_20px_-6px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_25px_-6px_rgba(0,0,0,0.3)] hover:bg-deep-teal/95 active:scale-[0.98] shrink-0"
            >
              <Plus size={18} />
              NHẬP KHO MỚI
            </button>

            <AnimatePresence>
              {!isMobile && showAddForm && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAddForm(false)}
                  ></div>
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 sm:right-0 -mr-2 sm:mr-0 mt-3 w-[calc(100vw-32px)] sm:w-[400px] max-w-[400px] z-[999999] origin-top-right"
                  >
                    <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-sky-100">
                      <div className="bg-deep-teal p-6 text-white relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-xl font-black flex items-center gap-2">
                              <span className="w-2 h-6 bg-coral rounded-full"></span>
                              Nhập Kho
                            </h3>
                            <p className="text-white/60 text-xs mt-1 font-medium">
                              Thêm sản phẩm mới vào danh mục
                            </p>
                          </div>
                          <button
                            onClick={() => setShowAddForm(false)}
                            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
                          >
                            <X size={16} className="text-white/60" />
                          </button>
                        </div>
                      </div>

                      <div className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setType("vnl")}
                            className={cn(
                              "h-12 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-2",
                              type === "vnl"
                                ? "bg-deep-teal text-white border-deep-teal shadow-md"
                                : "bg-sky-50 text-deep-teal/40 border-sky-100 hover:bg-sky-100",
                            )}
                          >
                            <Warehouse size={16} />
                            VNL
                          </button>
                          <button
                            onClick={() => setType("external")}
                            className={cn(
                              "h-12 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-2",
                              type === "external"
                                ? "bg-amber-500 text-white border-amber-500 shadow-md"
                                : "bg-sky-50 text-deep-teal/40 border-sky-100 hover:bg-sky-100",
                            )}
                          >
                            <Box size={16} />
                            Ngoài
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                              Tên sản phẩm
                            </label>
                            <input
                              type="text"
                              placeholder="VD: Kem dưỡng trắng..."
                              className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-coral/30 rounded-2xl px-5 text-sm font-bold text-deep-teal focus:ring-0 outline-none transition-all placeholder:text-deep-teal/20"
                              value={name}
                              onChange={(e) => {
                                setName(e.target.value);
                                setType(detectInventoryType(e.target.value));
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                                Đơn giá
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="0"
                                  className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-coral rounded-2xl px-5 text-sm font-bold text-coral focus:ring-0 outline-none transition-all placeholder:text-coral/20"
                                  value={price}
                                  onChange={(e) =>
                                    setPrice(
                                      formatCurrencyInput(e.target.value),
                                    )
                                  }
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-coral/40 font-black text-xs">
                                  ₫
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                                Giá vốn
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="0"
                                  className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-amber-500 rounded-2xl px-5 text-sm font-bold text-amber-500 focus:ring-0 outline-none transition-all placeholder:text-amber-500/20"
                                  value={costPrice}
                                  onChange={(e) =>
                                    setCostPrice(
                                      formatCurrencyInput(e.target.value),
                                    )
                                  }
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500/40 font-black text-xs">
                                  ₫
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                                Số lượng
                              </label>
                              <input
                                type="number"
                                placeholder="0"
                                className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-deep-teal rounded-2xl px-5 text-sm font-bold text-deep-teal focus:ring-0 outline-none transition-all placeholder:text-deep-teal/20"
                                value={qty}
                                onChange={(e) => setQty(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={addProduct}
                          disabled={isSaving}
                          className={cn(
                            "w-full h-12 bg-coral text-white rounded-2xl font-black uppercase shadow-lg shadow-coral/20 transition-all text-xs tracking-widest disabled:opacity-50 mt-2",
                            !isSaving && "hover:bg-coral-600 active:scale-95",
                          )}
                        >
                          {isSaving ? "Đang xử lý..." : "Xác nhận nhập kho"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {isMobile &&
              createPortal(
                <AnimatePresence>
                  {showAddForm && (
                    <div className="fixed inset-0 z-[100000]">
                      <div
                        className="fixed inset-0 bg-deep-teal/20 backdrop-blur-sm"
                        onClick={() => setShowAddForm(false)}
                      ></div>
                      <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        className="absolute bottom-0 left-0 right-0 max-h-[90vh] bg-white rounded-t-3xl overflow-hidden shadow-2xl flex flex-col"
                      >
                        <div className="bg-deep-teal p-5 text-white relative shrink-0">
                          <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-4"></div>
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-xl font-black flex items-center gap-2">
                                <span className="w-2 h-6 bg-coral rounded-full"></span>
                                Nhập Kho
                              </h3>
                              <p className="text-white/60 text-xs mt-1 font-medium">
                                Thêm sản phẩm mới vào danh mục
                              </p>
                            </div>
                            <button
                              onClick={() => setShowAddForm(false)}
                              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                            >
                              <X size={16} className="text-white/60" />
                            </button>
                          </div>
                        </div>

                        <div className="p-5 flex-1 overflow-y-auto space-y-5">
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              onClick={() => setType("vnl")}
                              className={cn(
                                "h-12 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-2",
                                type === "vnl"
                                  ? "bg-deep-teal text-white border-deep-teal shadow-md"
                                  : "bg-sky-50 text-deep-teal/40 border-sky-100 hover:bg-sky-100",
                              )}
                            >
                              <Warehouse size={16} />
                              VNL
                            </button>
                            <button
                              onClick={() => setType("external")}
                              className={cn(
                                "h-12 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-2",
                                type === "external"
                                  ? "bg-amber-500 text-white border-amber-500 shadow-md"
                                  : "bg-sky-50 text-deep-teal/40 border-sky-100 hover:bg-sky-100",
                              )}
                            >
                              <Box size={16} />
                              Ngoài
                            </button>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                                Tên sản phẩm
                              </label>
                              <input
                                type="text"
                                placeholder="VD: Kem dưỡng trắng..."
                                className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-coral/30 rounded-2xl px-5 text-sm font-bold text-deep-teal focus:ring-0 outline-none transition-all placeholder:text-deep-teal/20"
                                value={name}
                                onChange={(e) => {
                                  setName(e.target.value);
                                  setType(detectInventoryType(e.target.value));
                                }}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                                  Đơn giá
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="0"
                                    className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-coral rounded-2xl px-5 text-sm font-bold text-coral focus:ring-0 outline-none transition-all placeholder:text-coral/20"
                                    value={price}
                                    onChange={(e) =>
                                      setPrice(
                                        formatCurrencyInput(e.target.value),
                                      )
                                    }
                                  />
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-coral/40 font-black text-xs">
                                    ₫
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                                  Giá vốn
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="0"
                                    className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-amber-500 rounded-2xl px-5 text-sm font-bold text-amber-500 focus:ring-0 outline-none transition-all placeholder:text-amber-500/20"
                                    value={costPrice}
                                    onChange={(e) =>
                                      setCostPrice(
                                        formatCurrencyInput(e.target.value),
                                      )
                                    }
                                  />
                                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-500/40 font-black text-xs">
                                    ₫
                                  </span>
                                </div>
                              </div>
                              <div className="space-y-1.5 col-span-2">
                                <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest ml-2">
                                  Số lượng
                                </label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  className="w-full h-12 bg-sky-50 border-2 border-transparent focus:border-deep-teal rounded-2xl px-5 text-sm font-bold text-deep-teal focus:ring-0 outline-none transition-all placeholder:text-deep-teal/20"
                                  value={qty}
                                  onChange={(e) => setQty(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={addProduct}
                            disabled={isSaving}
                            className={cn(
                              "w-full h-12 bg-coral text-white rounded-2xl font-black uppercase shadow-lg shadow-coral/20 transition-all text-xs tracking-widest disabled:opacity-50 mt-2 flex items-center justify-center",
                              !isSaving && "hover:bg-coral-600 active:scale-95",
                            )}
                          >
                            {isSaving ? "Đang xử lý..." : "Xác nhận nhập kho"}
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>,
                document.body,
              )}
          </div>
        </div>

        {/* Filters & Actions row */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Categories */}
          <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/50 shadow-sm overflow-x-auto hide-scrollbar w-full sm:w-auto">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap",
                categoryFilter === "all"
                  ? "bg-white text-deep-teal shadow-sm border border-slate-100"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50",
              )}
            >
              Tất cả sản phẩm
            </button>
            <button
              onClick={() => setCategoryFilter("vnl")}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap",
                categoryFilter === "vnl"
                  ? "bg-deep-teal/5 text-deep-teal shadow-sm border border-deep-teal/10"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50",
              )}
            >
              Hàng VNL
            </button>
            <button
              onClick={() => setCategoryFilter("external")}
              className={cn(
                "px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap",
                categoryFilter === "external"
                  ? "bg-amber-500/10 text-amber-700 shadow-sm border border-amber-500/20"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50",
              )}
            >
              Hàng Ngoài
            </button>
          </div>

          {/* Sort & Quick Filters */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {/* Sort Toggle */}
            <div className="relative shrink-0 w-1/2 sm:w-auto">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={cn(
                  "w-full px-4 py-2.5 h-11 items-center justify-center rounded-2xl text-[13px] font-bold transition-all flex gap-2 border bg-white shadow-sm border-slate-200/50",
                  showSortMenu
                    ? "ring-2 ring-deep-teal/20 text-deep-teal"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <ListFilter size={16} />
                <span>Sắp xếp</span>
              </button>
              <AnimatePresence>
                {showSortMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-[100]"
                      onClick={() => setShowSortMenu(false)}
                    ></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-[101]"
                    >
                      <div className="p-2 flex flex-col gap-1">
                        {[
                          { id: "name_asc", label: "Tên A-Z" },
                          { id: "price_asc", label: "Giá: Thấp đến Cao" },
                          { id: "price_desc", label: "Giá: Cao đến Thấp" },
                          { id: "qty_asc", label: "Tồn kho: Ít đến Nhiều" },
                          { id: "qty_desc", label: "Tồn kho: Nhiều đến Ít" },
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              setSortBy(option.id as any);
                              setShowSortMenu(false);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 text-[13px] font-semibold rounded-xl transition-all",
                              sortBy === option.id
                                ? "bg-sky-50/80 text-deep-teal"
                                : "text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Low stock */}
            <button
              onClick={() =>
                setStockFilter(stockFilter === "all" ? "low" : "all")
              }
              className={cn(
                "w-1/2 sm:w-auto px-4 py-2.5 h-11 items-center justify-center rounded-2xl text-[13px] font-bold transition-all flex gap-2 border shadow-sm",
                stockFilter === "low"
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-white text-slate-600 border-slate-200/50 hover:bg-slate-50",
              )}
            >
              <AlertTriangle
                size={16}
                className={
                  stockFilter === "low" ? "text-red-500" : "text-slate-400"
                }
              />
              <span>Sắp hết</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-6">
        {[
          {
            label: "Tổng sản phẩm",
            val: items.length.toLocaleString(),
            icon: Package,
            color: "teal",
            bg: "bg-white",
          },
          {
            label: "Cảnh báo tồn",
            val: items.filter((i) => (i.qty || 0) <= 5).length.toLocaleString(),
            icon: AlertTriangle,
            color: "red",
            bg: "bg-red-50/50",
          },
          {
            label: "Hàng VNL",
            val: items.filter((i) => i.type === "vnl").length.toLocaleString(),
            icon: Warehouse,
            color: "emerald",
            bg: "bg-emerald-50/50",
          },
          {
            label: "Hàng Ngoài",
            val: items
              .filter((i) => i.type === "external")
              .length.toLocaleString(),
            icon: Box,
            color: "amber",
            bg: "bg-amber-50/50",
          },
          {
            label: "Tổng Tiền Vốn",
            val: formatMoney(
              items.reduce(
                (sum, item) => sum + (item.costPrice || 0) * (item.qty || 0),
                0,
              ),
            ),
            icon: DollarSign,
            color: "amber",
            bg: "bg-amber-50/50",
          },
          {
            label: "Tổng Tiền Bán",
            val: formatMoney(
              items.reduce(
                (sum, item) => sum + (item.price || 0) * (item.qty || 0),
                0,
              ),
            ),
            icon: DollarSign,
            color: "emerald",
            bg: "bg-emerald-50/50",
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className={cn(
              "glass-card !p-5 border-white shadow-sm flex flex-col justify-between group relative overflow-hidden",
              stat.bg,
            )}
          >
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm",
                stat.color === "teal"
                  ? "bg-sky-50 text-deep-teal"
                  : stat.color === "red"
                    ? "bg-red-100 text-red-500"
                    : stat.color === "emerald"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-amber-100 text-amber-600",
              )}
            >
              <stat.icon size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.2em] whitespace-nowrap">
                {stat.label}
              </span>
              <h4
                className="text-[clamp(1rem,2vw,1.5rem)] font-black text-deep-teal mt-1 truncate"
                title={stat.val}
              >
                {stat.val}
              </h4>
            </div>
            <div className="absolute -bottom-4 -right-4 opacity-[0.03] group-hover:scale-110 transition-transform">
              <stat.icon size={80} />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="glass-card !p-0 !bg-white/60 overflow-hidden border-white shadow-xl">
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-sky-100/50">
          <h2 className="text-lg md:text-xl font-black text-deep-teal flex items-center gap-3">
            <span className="w-1.5 h-6 md:h-8 bg-coral rounded-full"></span>
            Kho Hàng Thực Tế
          </h2>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-[10px] font-black text-deep-teal/30 bg-sky-50 px-4 py-2 rounded-full uppercase tracking-tighter shadow-inner">
              {sortedItems.length} sản phẩm được hiển thị
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-deep-teal/40 text-[10px] uppercase font-black tracking-[0.2em] border-b border-sky-100/50">
                <th className="py-6 px-8">Thông tin sản phẩm</th>
                <th className="py-6 px-6">Phân loại</th>
                <th className="py-6 px-6 text-center">Giá vốn</th>
                <th className="py-6 px-6 text-center">Đơn giá</th>
                <th className="py-6 px-6 text-center">Tồn kho</th>
                <th className="py-6 px-8 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/30">
              {visibleItems.map((item) => (
                <tr
                  key={item.id}
                  className="group hover:bg-sky-50/50 transition-colors"
                >
                  <td className="py-5 px-8">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            updateProduct(item.id, "name", e.target.value)
                          }
                          className="bg-transparent font-black text-deep-teal text-base focus:outline-none w-full truncate"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <select
                      value={item.type || "vnl"}
                      onChange={(e) =>
                        updateProduct(item.id, "type", e.target.value)
                      }
                      className={cn(
                        "text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-tighter outline-none border transition-colors cursor-pointer",
                        item.type === "external"
                          ? "bg-amber-50 text-amber-600 border-amber-100"
                          : "bg-emerald-50 text-emerald-600 border-emerald-100",
                      )}
                    >
                      <option value="vnl">HÀNG VNL</option>
                      <option value="external">HÀNG NGOÀI</option>
                    </select>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-amber-500/40 font-black text-xs">
                        ₫
                      </span>
                      <input
                        type="text"
                        value={
                          item.costPrice
                            ? new Intl.NumberFormat("en-US").format(
                                item.costPrice,
                              )
                            : "0"
                        }
                        onChange={(e) =>
                          updateProduct(
                            item.id,
                            "costPrice",
                            parseCurrency(e.target.value),
                          )
                        }
                        className="bg-transparent text-amber-500 font-black text-base text-center w-28 focus:outline-none hover:bg-amber-100/50 rounded-lg p-1 transition-colors"
                      />
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-coral/40 font-black text-xs">
                        ₫
                      </span>
                      <input
                        type="text"
                        value={
                          item.price
                            ? new Intl.NumberFormat("en-US").format(item.price)
                            : "0"
                        }
                        onChange={(e) =>
                          updateProduct(
                            item.id,
                            "price",
                            parseCurrency(e.target.value),
                          )
                        }
                        className="bg-transparent text-coral font-black text-base text-center w-28 focus:outline-none hover:bg-coral/5 rounded-lg p-1 transition-colors"
                      />
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        value={item.qty ?? 0}
                        onChange={(e) =>
                          updateProduct(
                            item.id,
                            "qty",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        className={cn(
                          "bg-transparent text-center font-black text-lg w-20 focus:outline-none border-b-2 border-transparent focus:border-deep-teal px-2 py-1",
                          (item.qty || 0) <= 5
                            ? "text-red-500"
                            : "text-deep-teal",
                        )}
                      />
                      {(item.qty || 0) <= 5 && (
                        <AlertTriangle
                          size={16}
                          className="text-red-500 animate-pulse"
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-8 text-right">
                    {confirmingDeleteId === item.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => deleteProduct(item)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase shadow-md shadow-red-500/20 whitespace-nowrap px-4 hover:scale-105 transition-transform"
                        >
                          Xác nhận
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="w-8 h-8 rounded-lg bg-white border border-sky-100 text-deep-teal/40 hover:bg-sky-50 transition-all flex items-center justify-center"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => setConfirmingDeleteId(item.id)}
                          className="w-10 h-10 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm ml-auto"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid/Card View (Optimized) */}
        <div className="md:hidden p-4 space-y-4">
          <AnimatePresence>
            {visibleItems.map((item) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={item.id}
                className="bg-white rounded-[24px] p-4 border border-sky-100 shadow-sm relative group active:scale-[0.98] transition-transform"
              >
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <select
                        value={item.type || "vnl"}
                        onChange={(e) =>
                          updateProduct(item.id, "type", e.target.value)
                        }
                        className={cn(
                          "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter outline-none border cursor-pointer",
                          item.type === "external"
                            ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100",
                        )}
                      >
                        <option value="vnl">HÀNG VNL</option>
                        <option value="external">HÀNG NGOÀI</option>
                      </select>
                      <div className="flex items-center gap-1 bg-sky-50 px-2 py-1 rounded-lg border border-sky-100 focus-within:ring-2 focus-within:ring-sky-200 transition-all">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Tồn:
                        </span>
                        <input
                          type="number"
                          value={item.qty ?? 0}
                          onChange={(e) =>
                            updateProduct(
                              item.id,
                              "qty",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className={cn(
                            "bg-transparent text-center font-black text-sm w-12 focus:outline-none",
                            (item.qty || 0) <= 5
                              ? "text-red-500"
                              : "text-deep-teal",
                          )}
                        />
                        {(item.qty || 0) <= 5 && (
                          <AlertTriangle
                            size={12}
                            className="text-red-500 animate-pulse shrink-0"
                          />
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        updateProduct(item.id, "name", e.target.value)
                      }
                      className="font-black text-deep-teal text-[16px] w-full focus:outline-none focus:bg-sky-50 rounded-lg px-2 py-1 -ml-2 mb-2 transition-colors"
                      placeholder="Tên sản phẩm"
                    />

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 flex flex-col focus-within:ring-2 focus-within:ring-amber-200 transition-all">
                        <span className="text-[9px] font-black text-amber-600/60 uppercase tracking-widest mb-1">
                          Giá vốn
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-amber-500/40 font-black text-xs">
                            ₫
                          </span>
                          <input
                            type="text"
                            value={
                              item.costPrice
                                ? new Intl.NumberFormat("en-US").format(
                                    item.costPrice,
                                  )
                                : "0"
                            }
                            onChange={(e) =>
                              updateProduct(
                                item.id,
                                "costPrice",
                                parseCurrency(e.target.value),
                              )
                            }
                            className="bg-transparent text-amber-600 font-black text-[15px] w-full focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="bg-coral/5 p-2.5 rounded-xl border border-coral/10 flex flex-col focus-within:ring-2 focus-within:ring-coral/20 transition-all">
                        <span className="text-[9px] font-black text-coral/60 uppercase tracking-widest mb-1">
                          Giá bán
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-coral/40 font-black text-xs">
                            ₫
                          </span>
                          <input
                            type="text"
                            value={
                              item.price
                                ? new Intl.NumberFormat("en-US").format(
                                    item.price,
                                  )
                                : "0"
                            }
                            onChange={(e) =>
                              updateProduct(
                                item.id,
                                "price",
                                parseCurrency(e.target.value),
                              )
                            }
                            className="bg-transparent text-coral font-black text-[15px] w-full focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 border-t border-slate-100">
                      {confirmingDeleteId === item.id ? (
                        <div className="flex gap-2 animate-fade-in">
                          <button
                            onClick={() => deleteProduct(item)}
                            className="px-4 py-1.5 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-600 shadow-sm shadow-red-500/20"
                          >
                            XÓA
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteId(null)}
                            className="w-8 h-8 rounded-xl bg-sky-50 text-slate-500 flex items-center justify-center hover:bg-sky-100"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingDeleteId(item.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Load More Button */}
        {displayedCount < sortedItems.length && (
          <div className="p-8 flex justify-center border-t border-sky-100/30">
            <button
              onClick={() => setDisplayedCount((prev) => prev + ITEMS_PER_PAGE)}
              className="px-12 py-3.5 bg-white text-deep-teal rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-sm hover:shadow-md border border-sky-100 transition-all active:scale-95 flex items-center gap-3"
            >
              <span>
                Xem thêm sản phẩm ({sortedItems.length - displayedCount})
              </span>
              <Plus size={14} className="opacity-40" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
