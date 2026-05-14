import { getTenantCollection, getTenantDoc } from "../lib/tenant";
import React, { useState, useEffect, useRef } from "react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { Customer } from "../types";
import { useAuth } from "../AuthProvider";
import {
  formatMoney,
  cn,
  showToast,
  removeVietnameseTones,
} from "../lib/utils";
import {
  Users,
  Search,
  Download,
  Plus,
  Trash2,
  Smartphone,
  User,
  MapPin,
  Cake,
  Heart,
  Briefcase,
  StickyNote,
  X,
  Phone,
  MessageCircle,
  FileUp,
  FileDown,
  Gift,
  PartyPopper,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";

import * as XLSX from "xlsx";

const isUpcomingIn7Days = (dateStr: string) => {
  if (!dateStr) return false;
  const parts = dateStr.split("/");
  if (parts.length < 2) return false;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  if (isNaN(day) || isNaN(month)) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentYear = today.getFullYear();
  let nextDate = new Date(currentYear, month, day);

  if (nextDate.getTime() < today.getTime()) {
    nextDate = new Date(currentYear + 1, month, day);
  }

  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays <= 7 && diffDays >= 0;
};

export const CustomersView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const ITEMS_PER_PAGE = 20;
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(searchInput);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [search]);

  const [sort, setSort] = useState<"newest" | "oldest" | "name" | "spending">(
    "newest",
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState(
    `DanhSachKhachHang_${new Date().toISOString().split("T")[0]}`,
  );
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportExcel = () => {
    try {
      const exportData = customers.map((c) => ({
        Tên: c.name,
        "Số điện thoại": c.phone,
        "Địa chỉ": c.address,
        "Nghề nghiệp": c.job,
        "Sinh nhật": c.birthday,
        "Ngày kỷ niệm": c.anniversary,
        "Ghi chú": c.note,
        "Trạng thái": c.status,
        "Tổng chi tiêu": Math.abs(c.totalSpent || 0),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KhachHang");
      XLSX.writeFile(wb, `${exportFileName || "DanhSachKhachHang"}.xlsx`);
      setIsExportModalOpen(false);
      showToast("Xuất Excel thành công!");
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
        const name = String(row["Tên"] || "").trim();
        if (!phone || !name) continue;

        await setDoc(
          getTenantDoc("customers", phone, user),
          {
            name: name.substring(0, 100),
            phone: phone.substring(0, 20),
            address: String(row["Địa chỉ"] || ""),
            birthday: String(row["Sinh nhật"] || ""),
            anniversary: String(row["Ngày kỷ niệm"] || ""),
            job: String(row["Nghề nghiệp"] || ""),
            note: String(row["Ghi chú"] || ""),
            status: String(row["Trạng thái"] || "Chưa PL"),
            totalSpent: Number(row["Tổng chi tiêu"] || 0),
            createdAt: serverTimestamp(),
          },
          { merge: true },
        );
        importedCount++;
      }

      showToast(`Đã nhập thành công ${importedCount} khách hàng!`);
    } catch (error) {
      console.error(error);
      showToast("Lỗi định dạng file Excel!");
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // New Customer Form
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [job, setJob] = useState("");
  const [note, setNote] = useState("");
  const [birthday, setBirthday] = useState("");
  const [anniversary, setAnniversary] = useState("");

  useEffect(() => {
    // Initialize flatpickr for modal
    if (isModalOpen) {
      setTimeout(() => {
        flatpickr("#new-customer-birthday", {
          dateFormat: "d/m/Y",
          allowInput: true,
        });
        flatpickr("#new-customer-anniversary", {
          dateFormat: "d/m/Y",
          allowInput: true,
        });
      }, 100);
    }
  }, [isModalOpen]);

  useEffect(() => {
    // Initialize flatpickr for table rows
    if (!loading) {
      setTimeout(() => {
        flatpickr(".birthday-picker", {
          dateFormat: "d/m/Y",
          allowInput: true,
          onChange: (selectedDates, dateStr, instance) => {
            const customerId = instance.element.getAttribute("data-id");
            if (customerId) updateCustomer(customerId, "birthday", dateStr);
          },
        });
        flatpickr(".anniversary-picker", {
          dateFormat: "d/m/Y",
          allowInput: true,
          onChange: (selectedDates, dateStr, instance) => {
            const customerId = instance.element.getAttribute("data-id");
            if (customerId) updateCustomer(customerId, "anniversary", dateStr);
          },
        });
      }, 500);
    }
  }, [loading, customers, search, sort]);

  useEffect(() => {
    if (!user) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    const q = query(
      getTenantCollection("customers", user),
      orderBy("name", "asc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCustomers(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Customer,
          ),
        );
        setLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "customers"),
    );
    return unsubscribe;
  }, [user]);

  const [isSaving, setIsSaving] = useState(false);

  const addCustomer = async () => {
    if (isSaving) return;
    if (!phone || !name) {
      alert("Vui lòng nhập tên và SĐT!");
      return;
    }

    setIsSaving(true);
    try {
      await setDoc(
        getTenantDoc("customers", phone, user),
        {
          name,
          phone,
          address,
          birthday,
          anniversary,
          job,
          note,
          status: "Chưa PL",
          totalSpent: 0,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
      setPhone("");
      setName("");
      setAddress("");
      setJob("");
      setNote("");
      setBirthday("");
      setAnniversary("");
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "customers");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCustomer = async (
    phone: string,
    field: keyof Customer,
    value: any,
  ) => {
    try {
      await updateDoc(getTenantDoc("customers", phone, user), {
        [field]: value,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${phone}`);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    try {
      await deleteDoc(getTenantDoc("customers", customer.id, user));
      setConfirmingDeleteId(null);
      showToast("Đã xóa khách hàng thành công!");
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `customers/${customer.id}`,
      );
    }
  };

  const deleteAllCustomers = async () => {
    try {
      const customersSnapshot = customers;
      if (customersSnapshot.length === 0) {
        showToast("Không có khách hàng nào để xóa");
        return;
      }

      let batch = writeBatch(db);
      let operationCount = 0;
      let totalDeleted = 0;

      for (const customer of customersSnapshot) {
        batch.delete(getTenantDoc("customers", customer.id, user));
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
      showToast(`Đã xóa tất cả ${totalDeleted} khách hàng!`);
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi xóa tất cả khách hàng!");
    }
  };

  const searchNormalized = removeVietnameseTones(search.toLowerCase());
  const sortedCustomers = [...customers]
    .filter(
      (c) =>
        removeVietnameseTones(c.name || "")
          .toLowerCase()
          .includes(searchNormalized) || (c.phone || "").includes(search),
    )
    .sort((a, b) => {
      if (sort === "newest")
        return (
          (b as any).createdAt?.toMillis() - (a as any).createdAt?.toMillis()
        );
      if (sort === "oldest")
        return (
          (a as any).createdAt?.toMillis() - (b as any).createdAt?.toMillis()
        );
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "spending") return b.totalSpent - a.totalSpent;
      return 0;
    });

  const visibleCustomers = sortedCustomers.slice(0, displayedCount);

  const upcomingEvents = customers.reduce((acc: any[], customer) => {
    if (customer.birthday && isUpcomingIn7Days(customer.birthday)) {
      acc.push({ customer, type: "birthday", dateStr: customer.birthday });
    }
    if (customer.anniversary && isUpcomingIn7Days(customer.anniversary)) {
      acc.push({
        customer,
        type: "anniversary",
        dateStr: customer.anniversary,
      });
    }
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      {/* Search and Filters Header */}
      <section className="glass-card">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="flex flex-col gap-1 shrink-0">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 shrink-0">
                <span className="w-2 h-8 bg-coral rounded-full"></span>
                Trung tâm dữ liệu khách hàng
                <span className="bg-sky-100 text-sky-600 text-xs px-2 py-0.5 rounded-full ml-2">
                  {customers.length}
                </span>
              </h2>
            </div>

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
                  title="Xóa tất cả khách hàng"
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
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  placeholder="Tìm kiếm khách hàng..."
                  className="theme-input pl-12 h-11 text-sm w-full shadow-sm border-sky-100 focus:border-deep-teal/30"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full bg-white/60 p-4 border border-sky-50 rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
              <div className="flex items-center gap-3 bg-sky-50/50 px-4 py-2 rounded-xl border border-deep-teal/5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Lọc
                </span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer pr-2"
                >
                  <option value="name">Tên A-Z</option>
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                  <option value="spending">Chi tiêu</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="h-11 px-6 bg-deep-teal text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-deep-teal/90 transition-all shadow-lg shadow-deep-teal/20 flex items-center justify-center gap-2 w-full sm:w-auto shrink-0"
            >
              <Plus size={16} /> Thêm mới
            </button>
          </div>
        </div>
      </section>

      {upcomingEvents.length > 0 && (
        <section className="bg-coral/5 border border-coral/20 rounded-2xl p-2.5 mb-6 flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0 pl-1 pr-3 border-r border-coral/20">
            <PartyPopper size={14} className="text-coral" />
            <span className="text-[10px] font-black text-coral uppercase tracking-widest whitespace-nowrap">
              Sắp tới (7 ngày)
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {upcomingEvents.map((event, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-white backdrop-blur-sm border border-coral/10 rounded-lg px-2 py-1 shrink-0"
              >
                {event.type === "birthday" ? (
                  <Cake size={12} className="text-coral" />
                ) : (
                  <Heart size={12} className="text-coral" />
                )}
                <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">
                  {event.customer.name}
                </span>
                <span className="text-[9px] font-black text-coral/80 whitespace-nowrap bg-coral/10 rounded px-1">
                  {event.dateStr}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="w-full">
        <main className="w-full">
          <section className="md:bg-white md:rounded-[32px] md:overflow-hidden md:shadow-sm md:border md:border-slate-200 relative z-10">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto hide-scrollbar max-h-[calc(100vh-230px)]">
              <table className="w-full text-left table-fixed min-w-[1000px]">
                <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm border-b border-slate-200">
                  <tr className="text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                    <th className="py-6 px-6 w-[25%]">Khách hàng</th>
                    <th className="py-6 px-4 w-[25%]">Lý lịch & Ghi chú</th>
                    <th className="py-6 px-4 w-[16%]">Dịp đặc biệt</th>
                    <th className="py-6 px-4 w-[14%]">Phân loại</th>
                    <th className="py-6 px-4 w-[12%] text-right">Tổng chi</th>
                    <th className="py-6 px-6 w-[8%] text-center">Lệnh</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {visibleCustomers.map((c) => (
                    <tr
                      key={c.id}
                      className="group border-t border-slate-100 first:border-0 hover:bg-slate-50 transition-colors bg-white"
                    >
                      <td className="py-6 px-6 align-top">
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text"
                            value={c.name || ""}
                            onChange={(e) =>
                              updateCustomer(c.id, "name", e.target.value)
                            }
                            className="bg-transparent font-bold text-slate-900 text-[15px] w-full focus:outline-none focus:bg-white/50 focus:ring-2 focus:ring-sky-100 rounded-lg transition-all px-1"
                          />
                          <div className="flex items-center gap-3 group/phone pl-1">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Smartphone size={14} />
                              <span className="font-mono text-xs font-bold tracking-wider text-slate-900">
                                {c.phone}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/phone:opacity-100 transition-all">
                              <a
                                href={`tel:${c.phone.replace(/\s+/g, "")}`}
                                className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-100 transition-colors active:scale-90"
                                title="Gọi điện"
                              >
                                <Phone size={12} />
                              </a>
                              <a
                                href={`https://zalo.me/${c.phone.replace(/\s+/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors active:scale-90"
                                title="Nhắn tin Zalo"
                              >
                                <MessageCircle size={12} />
                              </a>
                            </div>
                          </div>
                          <div className="relative mt-1 group/addr pl-1">
                            <MapPin
                              size={14}
                              className="absolute left-1 top-1 text-light-teal opacity-70"
                            />
                            <textarea
                              value={c.address || ""}
                              rows={2}
                              onChange={(e) =>
                                updateCustomer(c.id, "address", e.target.value)
                              }
                              className="bg-transparent text-slate-800 text-[13px] font-medium w-full focus:outline-none focus:bg-white/50 focus:ring-2 focus:ring-sky-100 rounded-lg pl-6 py-0.5 transition-all scrollbar-hide resize-none leading-relaxed placeholder:text-slate-400 placeholder:text-[12px]"
                              placeholder="Chưa có địa chỉ..."
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-4 align-top">
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-3 bg-emerald-50/70 px-3 py-2 rounded-xl border border-emerald-100/60 group/field focus-within:ring-2 focus-within:ring-emerald-200 transition-all">
                            <Briefcase
                              size={14}
                              className="text-emerald-500 shrink-0"
                            />
                            <input
                              type="text"
                              value={c.job || ""}
                              onChange={(e) =>
                                updateCustomer(c.id, "job", e.target.value)
                              }
                              className="bg-transparent text-slate-900 font-semibold text-[13px] focus:outline-none placeholder:text-slate-400 placeholder:text-[12px] placeholder:font-normal w-full"
                              placeholder="Nghề nghiệp..."
                            />
                          </div>
                          <div className="flex items-start gap-3 bg-amber-50/70 px-3 py-2 rounded-xl border border-amber-100/60 group/field focus-within:ring-2 focus-within:ring-amber-200 transition-all">
                            <StickyNote
                              size={14}
                              className="text-amber-500 shrink-0 mt-0.5"
                            />
                            <textarea
                              value={c.note || ""}
                              rows={2}
                              onChange={(e) =>
                                updateCustomer(c.id, "note", e.target.value)
                              }
                              className="bg-transparent text-slate-900 font-medium text-[13px] focus:outline-none placeholder:text-slate-400 placeholder:text-[12px] placeholder:font-normal w-full resize-none leading-relaxed"
                              placeholder="Ghi chú đặc biệt..."
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-4 align-top">
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-2 bg-coral/5 px-3 py-2 rounded-xl border border-coral/10 group/row focus-within:ring-2 focus-within:ring-coral/20">
                            <Cake size={14} className="text-coral shrink-0" />
                            <input
                              type="text"
                              value={c.birthday || ""}
                              data-id={c.id}
                              onChange={(e) =>
                                updateCustomer(c.id, "birthday", e.target.value)
                              }
                              className="birthday-picker bg-transparent text-coral font-bold text-[13px] w-full focus:outline-none placeholder:text-slate-400 placeholder:text-[12px] placeholder:font-normal"
                              placeholder="SN: DD/MM/YYYY"
                            />
                          </div>
                          <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-2 rounded-xl border border-sky-100 group/row focus-within:ring-2 focus-within:ring-sky-200">
                            <Heart
                              size={14}
                              className="text-sky-500 shrink-0"
                            />
                            <input
                              type="text"
                              value={c.anniversary || ""}
                              data-id={c.id}
                              onChange={(e) =>
                                updateCustomer(
                                  c.id,
                                  "anniversary",
                                  e.target.value,
                                )
                              }
                              className="anniversary-picker bg-transparent text-slate-900 font-bold text-[13px] w-full focus:outline-none placeholder:text-slate-400 placeholder:text-[12px] placeholder:font-normal"
                              placeholder="KN: DD/MM/YYYY"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-4 align-top">
                        <select
                          value={c.status || "Chưa PL"}
                          onChange={(e) =>
                            updateCustomer(c.id, "status", e.target.value)
                          }
                          className={cn(
                            "px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm ring-1 ring-white/50 cursor-pointer transition-all w-full text-center hover:scale-[1.02]",
                            c.status === "Vip" && "bg-teal-100 text-teal-700",
                            c.status === "Thân Thiết" &&
                              "bg-cyan-100 text-cyan-700",
                            c.status === "Vãn lai" && "bg-amber-100 text-amber-700",
                            c.status === "Chăm sóc" &&
                              "bg-sky-100 text-sky-700",
                            c.status === "Tái Tạo$$" &&
                              "bg-pink-100 text-pink-700",
                            (!c.status || c.status === "Chưa PL") &&
                              "bg-slate-100 text-slate-500",
                          )}
                        >
                          <option value="Chưa PL">❓ Chưa PL</option>
                          <option value="Vip">💎 VIP</option>
                          <option value="Thân Thiết">🤝 Thân Thiết</option>
                          <option value="Vãn lai">🍂 Vãn lai</option>
                          <option value="Chăm sóc">🌿 Chăm sóc</option>
                          <option value="Tái Tạo$$">🔄 Tái Tạo$$</option>
                        </select>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 text-center italic">
                          Phân hạng
                        </p>
                      </td>
                      <td className="py-6 px-4 text-right font-black text-slate-900 text-base align-top pt-8">
                        {formatMoney(c.totalSpent)}
                      </td>
                      <td className="py-6 px-6 text-center align-top pt-7">
                        {confirmingDeleteId === c.id ? (
                          <div className="flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-200">
                            <button
                              onClick={() => deleteCustomer(c)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-red-600 transition-colors shadow-sm"
                            >
                              Xóa
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="px-3 py-1.5 bg-white border border-sky-100 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-sky-50 transition-colors shadow-sm"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(c.id)}
                            className="w-10 h-10 rounded-2xl bg-white border border-red-50 shadow-sm text-red-300 hover:text-red-500 flex items-center justify-center transition-all hover:bg-red-50 active:scale-90 group/btn mx-auto"
                            title="Xoá khách hàng"
                          >
                            <Trash2
                              size={18}
                              className="transition-transform group-hover/btn:scale-110"
                            />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden mt-4 space-y-3 pb-24 relative z-10 w-full px-1">
              {visibleCustomers.map((c) => {
                const getColors = (status: string) => {
                  switch (status) {
                    case "Vip":
                      return {
                        bg: "bg-gradient-to-br from-teal-50 via-white to-emerald-50 shadow-[0_4px_20px_-4px_rgba(20,184,166,0.15)]",
                        border: "border-teal-200/60",
                        decor: "from-teal-200/40 to-transparent",
                        icon: "text-teal-500",
                        name: "text-teal-950",
                        phone: "text-teal-600/80",
                        placeholder: "placeholder:text-teal-300/80",
                        divider: "border-teal-100/50",
                        text: "text-teal-900/80",
                        bgInner:
                          "bg-white/60 backdrop-blur-sm border-teal-100/50",
                      };
                    case "Thân Thiết":
                      return {
                        bg: "bg-gradient-to-br from-cyan-50 via-white to-sky-50 shadow-[0_4px_20px_-4px_rgba(6,182,212,0.15)]",
                        border: "border-cyan-200/60",
                        decor: "from-cyan-200/40 to-transparent",
                        icon: "text-cyan-500",
                        name: "text-cyan-950",
                        phone: "text-cyan-600/80",
                        placeholder: "placeholder:text-cyan-300/80",
                        divider: "border-cyan-100/50",
                        text: "text-cyan-900/80",
                        bgInner:
                          "bg-white/60 backdrop-blur-sm border-cyan-100/50",
                      };
                    case "Vãn lai":
                      return {
                        bg: "bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.15)]",
                        border: "border-amber-200/60",
                        decor: "from-amber-200/40 to-transparent",
                        icon: "text-amber-500",
                        name: "text-amber-950",
                        phone: "text-amber-600/80",
                        placeholder: "placeholder:text-amber-300/80",
                        divider: "border-amber-100/50",
                        text: "text-amber-900/80",
                        bgInner:
                          "bg-white/60 backdrop-blur-sm border-amber-100/50",
                      };
                    case "Chăm sóc":
                      return {
                        bg: "bg-gradient-to-br from-sky-50 via-white to-blue-50 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.15)]",
                        border: "border-sky-200/60",
                        decor: "from-sky-200/40 to-transparent",
                        icon: "text-sky-500",
                        name: "text-sky-950",
                        phone: "text-sky-600/80",
                        placeholder: "placeholder:text-sky-300/80",
                        divider: "border-sky-100/50",
                        text: "text-sky-900/80",
                        bgInner:
                          "bg-white/60 backdrop-blur-sm border-sky-100/50",
                      };
                    case "Tái Tạo$$":
                      return {
                        bg: "bg-gradient-to-br from-rose-50 via-white to-pink-50 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.15)]",
                        border: "border-rose-200/60",
                        decor: "from-rose-200/40 to-transparent",
                        icon: "text-rose-500",
                        name: "text-rose-950",
                        phone: "text-rose-600/80",
                        placeholder: "placeholder:text-rose-300/80",
                        divider: "border-rose-100/50",
                        text: "text-rose-900/80",
                        bgInner:
                          "bg-white/60 backdrop-blur-sm border-rose-100/50",
                      };
                    default:
                      return {
                        bg: "bg-gradient-to-br from-slate-50 via-white to-gray-50 shadow-[0_4px_20px_-4px_rgba(148,163,184,0.15)]",
                        border: "border-slate-200/60",
                        decor: "from-slate-200/40 to-transparent",
                        icon: "text-slate-400",
                        name: "text-slate-900",
                        phone: "text-slate-500",
                        placeholder: "placeholder:text-slate-300",
                        divider: "border-slate-100/80",
                        text: "text-slate-700",
                        bgInner:
                          "bg-white/60 backdrop-blur-sm border-slate-100/50",
                      };
                  }
                };
                const colors = getColors(c.status || "Chưa PL");

                return (
                  <div
                    key={c.id}
                    className={`rounded-[24px] p-4 border flex flex-col gap-3 relative overflow-hidden transition-all ${colors.bg} ${colors.border}`}
                  >
                    {/* Decorative faint background element */}
                    <div
                      className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full pointer-events-none z-0 bg-gradient-to-bl opacity-60 ${colors.decor}`}
                    />
                    <div
                      className={`absolute -bottom-10 -left-10 w-40 h-40 rounded-full pointer-events-none z-0 bg-gradient-to-tr opacity-50 ${colors.decor}`}
                    />
                    <div className="relative z-10 flex flex-col gap-3">
                      {/* Top: Name, Phone & Status */}
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex flex-col flex-1 min-w-0">
                          <input
                            type="text"
                            value={c.name || ""}
                            onChange={(e) =>
                              updateCustomer(c.id, "name", e.target.value)
                            }
                            className={`bg-transparent font-bold text-[16px] w-full focus:outline-none transition-colors ${colors.name} ${colors.placeholder}`}
                            placeholder="Tên khách hàng"
                          />
                          <div
                            className={`flex items-center gap-1.5 mt-0.5 ${colors.phone}`}
                          >
                            <Smartphone size={13} className="shrink-0" />
                            <span className="font-mono text-[13px] font-semibold">
                              {c.phone}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <select
                            value={c.status || "Chưa PL"}
                            onChange={(e) =>
                              updateCustomer(c.id, "status", e.target.value)
                            }
                            className={cn(
                              "px-2 py-1 rounded-md border outline-none text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-sm text-center transition-colors",
                              c.status === "Vip"
                                ? "bg-teal-50 text-teal-600 border-teal-100"
                                : c.status === "Thân Thiết"
                                  ? "bg-cyan-50 text-cyan-600 border-cyan-100"
                                  : c.status === "Vãn lai"
                                    ? "bg-amber-50 text-amber-600 border-amber-100"
                                    : c.status === "Chăm sóc"
                                      ? "bg-sky-50 text-sky-600 border-sky-100"
                                      : c.status === "Tái Tạo$$"
                                        ? "bg-pink-50 text-pink-600 border-pink-100"
                                        : "bg-slate-50 text-slate-500 border-slate-100",
                            )}
                          >
                            <option value="Chưa PL">❓ Chưa PL</option>
                            <option value="Vip">💎 VIP</option>
                            <option value="Thân Thiết">🤝 Thân Thiết</option>
                            <option value="Vãn lai">🍂 Vãn lai</option>
                            <option value="Chăm sóc">🌿 Chăm sóc</option>
                            <option value="Tái Tạo$$">🔄 Tái Tạo$$</option>
                          </select>

                          <div className="flex gap-1.5">
                            <a
                              href={`tel:${c.phone.replace(/\s+/g, "")}`}
                              className="w-7 h-7 rounded-lg border border-slate-200/60 bg-white/80 shadow-sm text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors"
                            >
                              <Phone size={12} fill="currentColor" />
                            </a>
                            <a
                              href={`https://zalo.me/${c.phone.replace(/\s+/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-7 h-7 rounded-lg border border-blue-200/60 bg-blue-50/80 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors"
                            >
                              <MessageCircle size={14} fill="currentColor" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Body: Details (Compact) */}
                      <div
                        className={`rounded-xl p-3 space-y-2 border ${colors.bgInner}`}
                      >
                        <div className="flex items-start gap-2">
                          <MapPin
                            size={14}
                            className={`mt-[2px] shrink-0 ${colors.icon}`}
                          />
                          <textarea
                            value={c.address || ""}
                            rows={1}
                            onChange={(e) =>
                              updateCustomer(c.id, "address", e.target.value)
                            }
                            className={`bg-transparent text-[13px] font-medium w-full focus:outline-none resize-none leading-relaxed ${colors.text} ${colors.placeholder}`}
                            placeholder="Địa chỉ..."
                          />
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex flex-1 items-center gap-2">
                            <Briefcase
                              size={14}
                              className={`shrink-0 ${colors.icon}`}
                            />
                            <input
                              type="text"
                              value={c.job || ""}
                              onChange={(e) =>
                                updateCustomer(c.id, "job", e.target.value)
                              }
                              className={`bg-transparent text-[13px] font-medium w-full focus:outline-none ${colors.text} ${colors.placeholder}`}
                              placeholder="Nghề nghiệp"
                            />
                          </div>
                          <div className="flex flex-1 items-center gap-2">
                            <Cake
                              size={14}
                              className={`shrink-0 ${colors.icon}`}
                            />
                            <input
                              type="text"
                              value={c.birthday || ""}
                              data-id={c.id}
                              onChange={(e) =>
                                updateCustomer(c.id, "birthday", e.target.value)
                              }
                              className={`birthday-picker bg-transparent text-[13px] font-medium w-full focus:outline-none ${colors.text} ${colors.placeholder}`}
                              placeholder="Sinh nhật"
                            />
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <StickyNote
                            size={14}
                            className={`mt-[2px] shrink-0 ${colors.icon}`}
                          />
                          <textarea
                            value={c.note || ""}
                            rows={1}
                            onChange={(e) =>
                              updateCustomer(c.id, "note", e.target.value)
                            }
                            className={`bg-transparent text-[13px] font-medium w-full focus:outline-none resize-none leading-relaxed min-h-[22px] ${colors.text} ${colors.placeholder}`}
                            placeholder="Ghi chú..."
                          />
                        </div>
                      </div>

                      {/* Footer */}
                      <div
                        className={`flex justify-between items-end pt-2 border-t mt-1 ${colors.divider}`}
                      >
                        <div>
                          <div
                            className={`text-[10px] uppercase tracking-wider font-bold mb-0.5 ${colors.phone}`}
                          >
                            Tổng chi mua hàng
                          </div>
                          <div
                            className={`font-black text-[16px] leading-none ${colors.name}`}
                          >
                            {formatMoney(c.totalSpent)}
                          </div>
                        </div>

                        {confirmingDeleteId === c.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => deleteCustomer(c)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold transition-colors"
                            >
                              Xóa
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteId(null)}
                              className="px-3 py-1.5 bg-white/50 text-slate-600 rounded-lg text-xs font-bold transition-colors"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(c.id)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${colors.icon} hover:bg-red-50 hover:text-red-500`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {displayedCount < sortedCustomers.length && (
              <div className="flex justify-center p-6 border-t border-slate-100">
                <button
                  onClick={() =>
                    setDisplayedCount((prev) => prev + ITEMS_PER_PAGE)
                  }
                  className="px-6 py-2 bg-sky-50 text-sky-600 rounded-full font-black text-xs uppercase tracking-widest hover:bg-sky-100 transition-colors border border-sky-200 shadow-sm"
                >
                  Tải thêm ({sortedCustomers.length - displayedCount} khách)
                </button>
              </div>
            )}
          </section>
        </main>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-deep-teal/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-sky-50 flex items-center justify-between bg-sky-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-deep-teal flex items-center justify-center text-white shadow-lg">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                      Thêm khách mới
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Hệ thống CRM thông minh
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 rounded-xl hover:bg-white flex items-center justify-center text-slate-400 hover:text-slate-800 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="group/field">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5 ml-1">
                      Số điện thoại
                    </label>
                    <div className="relative">
                      <Smartphone
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-light-teal"
                      />
                      <input
                        type="text"
                        className="theme-input !pl-12 h-12 text-sm font-black text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] placeholder:font-normal"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09xx..."
                      />
                    </div>
                  </div>
                  <div className="group/field">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5 ml-1">
                      Họ và tên
                    </label>
                    <div className="relative">
                      <User
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-light-teal"
                      />
                      <input
                        type="text"
                        className="theme-input !pl-12 h-12 text-sm font-black text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] placeholder:font-normal"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tên khách..."
                      />
                    </div>
                  </div>
                </div>

                <div className="group/field">
                  <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5 ml-1">
                    Địa chỉ giao hàng
                  </label>
                  <div className="relative">
                    <MapPin
                      size={16}
                      className="absolute left-4 top-4 text-light-teal"
                    />
                    <textarea
                      className="theme-input !pl-12 h-24 py-3.5 text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] placeholder:font-normal"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Địa chỉ đầy đủ của khách hàng..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group/field">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5 ml-1">
                      Công việc
                    </label>
                    <div className="relative">
                      <Briefcase
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-light-teal"
                      />
                      <input
                        type="text"
                        className="theme-input !pl-12 h-12 text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] placeholder:font-normal"
                        value={job}
                        onChange={(e) => setJob(e.target.value)}
                        placeholder="Nghề nghiệp..."
                      />
                    </div>
                  </div>
                  <div className="group/field">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5 ml-1">
                      Ghi chú nhanh
                    </label>
                    <div className="relative">
                      <StickyNote
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-light-teal"
                      />
                      <input
                        type="text"
                        className="theme-input !pl-12 h-12 text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] placeholder:font-normal"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Lưu ý quan trọng..."
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group/field">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5 ml-1">
                      Sinh nhật
                    </label>
                    <div className="relative">
                      <Cake
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-coral"
                      />
                      <input
                        type="text"
                        id="new-customer-birthday"
                        className="theme-input !pl-12 h-12 text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] placeholder:font-normal"
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        placeholder="Ngày sinh..."
                      />
                    </div>
                  </div>
                  <div className="group/field">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest block mb-1.5 ml-1">
                      Kỷ niệm
                    </label>
                    <div className="relative">
                      <Heart
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-800"
                      />
                      <input
                        type="text"
                        id="new-customer-anniversary"
                        className="theme-input !pl-12 h-12 text-xs font-black text-slate-900 placeholder:text-slate-400 placeholder:text-[11px] placeholder:font-normal"
                        value={anniversary}
                        onChange={(e) => setAnniversary(e.target.value)}
                        placeholder="Ngày kỷ niệm..."
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={addCustomer}
                  disabled={isSaving}
                  className={cn(
                    "w-full py-4 bg-deep-teal text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-deep-teal/20 active:scale-95 hover:bg-deep-teal/90 transition-all tracking-[0.2em] disabled:opacity-50 disabled:scale-100",
                    isSaving && "cursor-not-allowed",
                  )}
                >
                  {isSaving ? "Đang lưu..." : "Xác nhận lưu thông tin"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                Xuất Excel Khách Hàng
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
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-3">
                Xóa tất cả khách hàng?
              </h3>
              <p className="text-sm text-slate-600 font-medium mb-8 leading-relaxed">
                Bạn có chắc chắn muốn xóa toàn bộ{" "}
                <span className="font-bold text-red-500">
                  {customers.length}
                </span>{" "}
                khách hàng?
                <br />
                Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsDeleteAllModalOpen(false)}
                  className="flex-1 py-4 bg-sky-50 text-slate-800 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-sky-100 transition-all border border-sky-100"
                >
                  Hủy
                </button>
                <button
                  onClick={deleteAllCustomers}
                  className="flex-1 py-4 bg-red-400 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-200"
                >
                  Xóa tất cả
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
