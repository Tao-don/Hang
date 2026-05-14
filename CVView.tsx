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
  setDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { CVAccumulation, CVMonthlyStat } from "../types";
import { useAuth } from "../AuthProvider";
import {
  formatMoney,
  parseCurrency,
  formatCurrencyInput,
  cn,
} from "../lib/utils";
import {
  Star,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  PenSquare,
  FileDown,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export const CVView: React.FC = () => {
  const { user } = useAuth();
  const [accs, setAccs] = useState<CVAccumulation[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<CVMonthlyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingDeleteAccId, setConfirmingDeleteAccId] = useState<
    string | null
  >(null);
  const [confirmingDeleteMonthlyId, setConfirmingDeleteMonthlyId] = useState<
    string | null
  >(null);

  // Form states for accumulation
  const [accDate, setAccDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [accAmount, setAccAmount] = useState("");
  const [accMethod, setAccMethod] = useState("CK");
  const [accNote, setAccNote] = useState("");
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [filterAccMonth, setFilterAccMonth] = useState(
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM format
  const [filterSummaryMonth, setFilterSummaryMonth] = useState(
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM format

  // Form states for monthly chốt
  const [monthPick, setMonthPick] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [monthCv, setMonthCv] = useState("");
  const [monthImport, setMonthImport] = useState("");
  const [monthNote, setMonthNote] = useState("");
  const [filterMonthlyYear, setFilterMonthlyYear] = useState(""); // YYYY format
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(
    {},
  );
  const [expandedAccMonths, setExpandedAccMonths] = useState<
    Record<string, boolean>
  >({});

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [month]: !prev[month],
    }));
  };

  const toggleAccMonth = (month: string) => {
    setExpandedAccMonths((prev) => ({
      ...prev,
      [month]: !(prev[month] ?? true),
    }));
  };

  useEffect(() => {
    if (!user) {
      setAccs([]);
      setLoading(false);
      return;
    }
    const q = query(
      getTenantCollection("cv_accumulations", user),
      orderBy("date", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setAccs(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as CVAccumulation,
          ),
        );
        setLoading(false);
      },
      (err) =>
        handleFirestoreError(err, OperationType.LIST, "cv_accumulations"),
    );
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMonthlyStats([]);
      return;
    }
    const q = query(
      getTenantCollection("cv_monthly", user),
      orderBy("month", "desc"),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setMonthlyStats(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as CVMonthlyStat,
          ),
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "cv_monthly"),
    );
    return unsubscribe;
  }, [user]);

  const saveAccumulation = async () => {
    if (!accAmount || !accDate) return;
    const data = {
      date: accDate,
      amount: parseCurrency(accAmount),
      method: accMethod,
      note: accNote,
      checked: false,
    };

    try {
      if (editingAccId) {
        await updateDoc(
          getTenantDoc("cv_accumulations", editingAccId, user),
          data,
        );
        setEditingAccId(null);
      } else {
        await addDoc(getTenantCollection("cv_accumulations", user), data);
      }
      setAccAmount("");
      setAccNote("");
      setAccDate(new Date().toISOString().split("T")[0]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "cv_accumulations");
    }
  };

  const saveMonthly = async () => {
    if (!monthPick) return;
    try {
      await addDoc(getTenantCollection("cv_monthly", user), {
        month: monthPick,
        cv: parseCurrency(monthCv),
        importAmt: parseCurrency(monthImport),
        note: monthNote,
        createdAt: serverTimestamp(),
      });
      setMonthCv("");
      setMonthImport("");
      setMonthNote("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "cv_monthly");
    }
  };

  const deleteAcc = async (acc: CVAccumulation) => {
    try {
      await deleteDoc(getTenantDoc("cv_accumulations", acc.id, user));
      setConfirmingDeleteAccId(null);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `cv_accumulations/${acc.id}`,
      );
    }
  };

  const deleteMonthly = async (stat: CVMonthlyStat) => {
    try {
      await deleteDoc(getTenantDoc("cv_monthly", stat.id, user));
      setConfirmingDeleteMonthlyId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `cv_monthly/${stat.id}`);
    }
  };

  const toggleCheck = async (id: string, current: boolean) => {
    await updateDoc(getTenantDoc("cv_accumulations", id, user), {
      checked: !current,
    });
  };

  const ITEMS_PER_PAGE = 20;
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    setDisplayedCount(ITEMS_PER_PAGE);
  }, [filterAccMonth]);

  const filteredAccs = accs.filter(
    (acc) => !filterAccMonth || acc.date.startsWith(filterAccMonth),
  );

  const visibleAccs = filteredAccs.slice(0, displayedCount);

  const groupedAccs = useMemo(() => {
    const groups: Record<
      string,
      {
        month: string;
        items: CVAccumulation[];
        totalAmount: number;
      }
    > = {};
    visibleAccs.forEach((acc) => {
      const month = acc.date.substring(0, 7);
      if (!groups[month]) {
        groups[month] = {
          month,
          items: [],
          totalAmount: 0,
        };
      }
      groups[month].items.push(acc);
      groups[month].totalAmount += acc.amount;
    });
    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
  }, [visibleAccs]);

  const summary = useMemo(() => {
    let filteredMonthly = monthlyStats;
    let filteredAccs = accs;

    if (filterSummaryMonth) {
      filteredMonthly = monthlyStats.filter(
        (m) => m.month === filterSummaryMonth,
      );
      filteredAccs = accs.filter((a) => a.date.startsWith(filterSummaryMonth));
    }

    const totalCV = filteredMonthly.reduce((s, m) => s + m.cv, 0);
    const totalAcc = filteredAccs.reduce((s, a) => s + a.amount, 0);
    const totalImport = filteredMonthly.reduce((s, m) => s + m.importAmt, 0);
    return { totalCV, totalAcc, totalImport, remain: totalAcc - totalImport };
  }, [accs, monthlyStats, filterSummaryMonth]);

  const groupedMonthlyStats = useMemo(() => {
    const groups: Record<
      string,
      {
        month: string;
        items: CVMonthlyStat[];
        totalCv: number;
        totalImport: number;
      }
    > = {};
    monthlyStats.forEach((m) => {
      if (!groups[m.month])
        groups[m.month] = {
          month: m.month,
          items: [],
          totalCv: 0,
          totalImport: 0,
        };
      groups[m.month].items.push(m);
      groups[m.month].totalCv += m.cv;
      groups[m.month].totalImport += m.importAmt;
    });
    return Object.values(groups).sort((a, b) => b.month.localeCompare(a.month)); // Sort descending
  }, [monthlyStats]);

  return (
    <div className="space-y-4 md:space-y-8 animate-fade-in">
      {/* Dashboard Summary section */}
      <section className="glass-card">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4 md:mb-8">
          <h3 className="font-black text-deep-teal text-xl flex items-center gap-3">
            <span className="w-2 h-8 bg-coral rounded-full"></span>
            Tổng quan tích lũy CV
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-2xl border border-deep-teal/5 shadow-sm">
              <Calendar size={14} className="text-deep-teal/40" />
              <input
                type="month"
                className="bg-transparent border-none text-[12px] font-black text-deep-teal outline-none cursor-pointer p-0 w-28"
                value={filterSummaryMonth}
                onChange={(e) => setFilterSummaryMonth(e.target.value)}
              />
              {filterSummaryMonth && (
                <button
                  onClick={() => setFilterSummaryMonth("")}
                  className="text-deep-teal/40 hover:text-red-500 w-5 flex justify-center"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <div className="glass-card !bg-white/40 border border-white/60 flex flex-col justify-between group overflow-hidden relative p-4 md:p-6 rounded-[24px]">
            <div className="absolute top-0 right-0 p-3 md:p-4 opacity-5 group-hover:scale-110 transition-transform">
              <CheckCircle2
                size={36}
                className="text-deep-teal md:size-[48px]"
              />
            </div>
            <span className="text-[9px] md:text-[10px] font-black text-deep-teal/40 uppercase tracking-[0.2em] md:tracking-[0.3em] block ml-1 leading-tight">
              Tổng CV Tích Lũy
            </span>
            <h4 className="text-xl md:text-3xl font-black text-deep-teal mt-3 md:mt-4 flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2 tracking-tighter">
              {summary.totalCV.toLocaleString()}
              <span className="text-[10px] md:text-xs font-black opacity-30 text-deep-teal uppercase">
                Cv
              </span>
            </h4>
          </div>
          <div className="glass-card !bg-emerald-500/5 !border-emerald-500/20 flex flex-col justify-between group overflow-hidden relative p-4 md:p-6 rounded-[24px]">
            <div className="absolute top-0 right-0 p-3 md:p-4 opacity-5 group-hover:scale-110 transition-transform">
              <TrendingUp
                size={36}
                className="text-emerald-500 md:size-[48px]"
              />
            </div>
            <span className="text-[9px] md:text-[10px] font-black text-emerald-500/60 uppercase tracking-[0.2em] md:tracking-[0.3em] block ml-1 leading-tight">
              Tiền Tích Lũy
            </span>
            <h4 className="text-xl md:text-3xl font-black text-emerald-700 mt-3 md:mt-4 tracking-tighter">
              {formatMoney(summary.totalAcc)}
            </h4>
          </div>
          <div className="glass-card !bg-red-500/5 !border-red-500/20 flex flex-col justify-between group overflow-hidden relative p-4 md:p-6 rounded-[24px]">
            <div className="absolute top-0 right-0 p-3 md:p-4 opacity-5 group-hover:scale-110 transition-transform">
              <TrendingDown size={36} className="text-red-500 md:size-[48px]" />
            </div>
            <span className="text-[9px] md:text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] md:tracking-[0.3em] block ml-1 leading-tight">
              Tiền Đơn Nhập
            </span>
            <h4 className="text-xl md:text-3xl font-black text-red-700 mt-3 md:mt-4 tracking-tighter">
              {formatMoney(summary.totalImport)}
            </h4>
          </div>
          <div className="glass-card !bg-deep-teal !border-none text-white shadow-2xl shadow-deep-teal/40 relative overflow-hidden p-4 md:p-6 rounded-[24px]">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white blur-[60px] rounded-full"></div>
            </div>
            <span className="text-[9px] md:text-[10px] font-black text-white/40 uppercase tracking-[0.2em] md:tracking-[0.3em] block ml-1 relative z-10 leading-tight">
              Dư Nợ Chưa Nâng
            </span>
            <h4 className="text-xl md:text-3xl font-black text-white mt-3 md:mt-4 relative z-10 tracking-tighter">
              {formatMoney(summary.remain)}
            </h4>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
        {/* Accumulation Section */}
        <section className="glass-card flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8">
            <h3 className="font-black text-deep-teal text-base flex items-center gap-3">
              <span className="w-1.5 h-6 bg-deep-teal rounded-full"></span>
              Hồ sơ tích lũy
            </h3>
            <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-1 rounded-xl border border-deep-teal/5">
              <span className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest whitespace-nowrap">
                Lọc theo tháng/năm
              </span>
              <input
                type="month"
                className="bg-transparent border-none text-[12px] font-black text-deep-teal outline-none cursor-pointer p-0 w-28"
                value={filterAccMonth}
                onChange={(e) => setFilterAccMonth(e.target.value)}
              />
              {filterAccMonth && (
                <button
                  onClick={() => setFilterAccMonth("")}
                  className="text-deep-teal/40 hover:text-red-500 w-5 flex justify-center"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="bg-gradient-to-br from-white/90 via-sky-50/80 to-coral/10 backdrop-blur-3xl p-5 rounded-[32px] border border-white/60 shadow-2xl shadow-deep-teal/10 mb-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-coral/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-deep-teal/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-5 relative z-10">
              <div className="col-span-1 md:col-span-4">
                <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest block mb-2 ml-2">
                  Ngày thực hiện
                </label>
                <input
                  type="date"
                  className="theme-input h-11 md:h-12 !py-2 uppercase tracking-tighter font-black text-xs md:text-sm"
                  value={accDate}
                  onChange={(e) => setAccDate(e.target.value)}
                />
              </div>
              <div className="col-span-1 md:col-span-3">
                <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest block mb-2 ml-2">
                  Hình thức
                </label>
                <select
                  className="theme-input h-11 md:h-12 !py-2 font-black cursor-pointer text-xs md:text-sm"
                  value={accMethod}
                  onChange={(e) => setAccMethod(e.target.value)}
                >
                  <option value="CK">Chuyển khoản</option>
                  <option value="TM">Tiền mặt</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-5">
                <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest block mb-2 ml-2">
                  Số tiền tích (VNĐ)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="theme-input h-11 md:h-12 !py-2 text-coral font-black text-sm md:text-base pr-8"
                    value={accAmount}
                    onChange={(e) =>
                      setAccAmount(formatCurrencyInput(e.target.value))
                    }
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-coral/30 font-black text-xs">
                    ₫
                  </span>
                </div>
              </div>
              <div className="col-span-2 md:col-span-9">
                <label className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest block mb-2 ml-2">
                  Nội dung ghi chú
                </label>
                <input
                  type="text"
                  className="theme-input h-11 md:h-12 !py-2 font-bold text-xs md:text-sm"
                  placeholder="..."
                  value={accNote}
                  onChange={(e) => setAccNote(e.target.value)}
                />
              </div>
              <div className="col-span-2 md:col-span-3 flex items-end">
                <button
                  onClick={saveAccumulation}
                  className="w-full h-11 md:h-12 bg-deep-teal text-white rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-xl active:scale-95 transition-all tracking-widest"
                >
                  {editingAccId ? "CẬP NHẬT" : "LƯU TÍCH LŨY"}
                </button>
              </div>
            </div>
          </div>
          <div className="md:hidden space-y-4 pb-4 max-h-[500px] overflow-y-auto hide-scrollbar">
            {groupedAccs.map((group) => {
              const isExpanded = expandedAccMonths[group.month] ?? true;
              return (
                <div
                  key={group.month}
                  className="bg-white/80 rounded-[24px] p-4 border border-sky-100 shadow-sm relative space-y-3"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-sky-100/50">
                    <button
                      onClick={() => toggleAccMonth(group.month)}
                      className="flex items-center gap-2 font-black text-deep-teal"
                    >
                      {isExpanded ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                      {group.month}
                    </button>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-coral/60 uppercase tracking-widest block">
                        Tổng tháng
                      </span>
                      <span className="font-bold text-coral text-sm">
                        {formatMoney(group.totalAmount)}
                      </span>
                    </div>
                  </div>
                  {isExpanded &&
                    group.items.map((acc) => (
                      <div
                        key={acc.id}
                        className="bg-white/80 rounded-[20px] p-4 border border-sky-50 shadow-sm relative mt-2"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-black text-deep-teal/60">
                            {acc.date.split("-").reverse().join("/")}
                          </span>
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                              acc.method === "CK"
                                ? "bg-blue-50 text-blue-500"
                                : "bg-emerald-50 text-emerald-500",
                            )}
                          >
                            {acc.method}
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                          <h4 className="text-xl font-black text-coral tracking-tighter">
                            {formatMoney(acc.amount)}
                          </h4>
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleCheck(acc.id, acc.checked)}
                              className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-sm border",
                                acc.checked
                                  ? "bg-green-50 border-green-100 text-green-700"
                                  : "bg-white border-sky-100 text-sky-400",
                              )}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            {confirmingDeleteAccId === acc.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => deleteAcc(acc)}
                                  className="px-2 py-1 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-600 shadow-sm"
                                >
                                  Xóa
                                </button>
                                <button
                                  onClick={() => setConfirmingDeleteAccId(null)}
                                  className="px-2 py-1 bg-white border border-sky-100 text-deep-teal rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingAccId(acc.id)}
                                  className="w-8 h-8 rounded-lg bg-white border border-sky-100 text-deep-teal/60 flex items-center justify-center shadow-sm"
                                >
                                  <PenSquare size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmingDeleteAccId(acc.id)
                                  }
                                  className="w-8 h-8 rounded-lg bg-white border border-sky-100 text-red-400 flex items-center justify-center shadow-sm"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {acc.note && (
                          <div className="mt-3 text-xs text-deep-teal/60 bg-sky-50/50 p-2 rounded-lg font-medium">
                            {acc.note}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto hide-scrollbar max-h-[500px]">
            <table className="w-full text-left">
              <thead>
                <tr className="text-deep-teal/40 text-[10px] uppercase font-black tracking-[0.2em] border-b border-deep-teal/5">
                  <th className="pb-4 px-4">Ngày tích</th>
                  <th className="pb-4 px-4 text-right">Khoản tiền</th>
                  <th className="pb-4 px-4 text-center">H.thức</th>
                  <th className="pb-4 px-4 text-center">Xác minh</th>
                  <th className="pb-4 px-4 text-right">Lệnh</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {groupedAccs.map((group) => {
                  const isExpanded = expandedAccMonths[group.month] ?? true;
                  return (
                    <React.Fragment key={group.month}>
                      <tr className="bg-sky-50/50 border-t border-deep-teal/5 relative">
                        <td
                          className="py-3 px-4 font-black text-deep-teal"
                          colSpan={4}
                        >
                          <button
                            onClick={() => toggleAccMonth(group.month)}
                            className="flex items-center gap-2 hover:text-coral transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                            {group.month}
                            <span className="text-[10px] font-bold text-deep-teal/40 bg-white px-2 py-0.5 rounded-lg ml-2">
                              {group.items.length} giao dịch
                            </span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-coral">
                          {formatMoney(group.totalAmount)}
                        </td>
                      </tr>
                      {isExpanded &&
                        group.items.map((acc) => (
                          <tr
                            key={acc.id}
                            className="group border-t border-dashed border-deep-teal/10 hover:bg-deep-teal/5 transition-colors"
                          >
                            <td className="py-4 px-4 pl-8 inline-flex flex-col gap-1">
                              <span className="font-black text-deep-teal/60">
                                {acc.date.split("-").reverse().join("/")}
                              </span>
                              {acc.note && (
                                <span className="text-[10px] text-deep-teal/40 font-medium max-w-[150px] truncate">
                                  {acc.note}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right font-black text-coral">
                              {formatMoney(acc.amount)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="px-3 py-1 bg-deep-teal/5 rounded-full text-[10px] font-black text-deep-teal/40 tracking-widest uppercase">
                                {acc.method}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => toggleCheck(acc.id, acc.checked)}
                                className={cn(
                                  "w-8 h-8 rounded-xl flex items-center justify-center transition-all mx-auto shadow-sm border",
                                  acc.checked
                                    ? "bg-green-50 border-green-100 text-green-700"
                                    : "bg-white border-sky-100 text-sky-400",
                                )}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="flex justify-end gap-2 transition-opacity">
                                {confirmingDeleteAccId === acc.id ? (
                                  <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                    <button
                                      onClick={() => deleteAcc(acc)}
                                      className="px-2 py-1 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-600 transition-colors shadow-sm"
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirmingDeleteAccId(null)
                                      }
                                      className="px-2 py-1 bg-white border border-sky-100 text-deep-teal rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-sky-50 transition-colors shadow-sm"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setEditingAccId(acc.id)}
                                      className="w-8 h-8 rounded-lg bg-white border border-sky-100 text-deep-teal/60 hover:text-deep-teal hover:bg-sky-50 flex items-center justify-center shadow-sm"
                                    >
                                      <PenSquare size={14} />
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirmingDeleteAccId(acc.id)
                                      }
                                      className="w-8 h-8 rounded-lg bg-white border border-sky-100 text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shadow-sm"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
            {displayedCount < filteredAccs.length && (
              <div className="flex justify-center p-4 border-t border-deep-teal/5">
                <button
                  onClick={() =>
                    setDisplayedCount((prev) => prev + ITEMS_PER_PAGE)
                  }
                  className="px-6 py-2 bg-sky-50 text-sky-600 rounded-full font-black text-xs uppercase tracking-widest hover:bg-sky-100 transition-colors border border-sky-200 shadow-sm"
                >
                  Tải thêm ({filteredAccs.length - displayedCount} tập)
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Monthly Recap Section */}
        <section className="glass-card flex flex-col">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-8">
            <h3 className="font-black text-deep-teal text-base flex items-center gap-3">
              <span className="w-1.5 h-6 bg-coral rounded-full"></span>
              Kết toán kỳ hạn
            </h3>
            <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-1 rounded-xl border border-coral/5">
              <span className="text-[10px] font-black text-coral/50 uppercase tracking-widest whitespace-nowrap">
                Lọc theo năm
              </span>
              <input
                type="number"
                min="2020"
                max="2100"
                step="1"
                className="bg-transparent border-none text-[12px] font-black text-deep-teal outline-none cursor-pointer p-0 w-16"
                value={filterMonthlyYear}
                onChange={(e) => setFilterMonthlyYear(e.target.value)}
                placeholder="YYYY"
              />
              {filterMonthlyYear && (
                <button
                  onClick={() => setFilterMonthlyYear("")}
                  className="text-coral/40 hover:text-red-500 w-5 flex justify-center"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="bg-gradient-to-br from-white/90 via-sky-50/80 to-coral/10 backdrop-blur-3xl p-5 rounded-[32px] border border-white/60 shadow-2xl shadow-deep-teal/10 mb-8 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-48 h-48 bg-coral/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-deep-teal/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-5 relative z-10">
              <div className="col-span-1 md:col-span-4">
                <label className="text-[10px] font-black text-coral/50 uppercase tracking-widest block mb-2 ml-2">
                  Kỳ kết toán
                </label>
                <input
                  type="month"
                  className="theme-input h-11 md:h-12 !py-2 font-black uppercase tracking-tighter text-xs md:text-sm"
                  value={monthPick}
                  onChange={(e) => setMonthPick(e.target.value)}
                />
              </div>
              <div className="col-span-1 md:col-span-3">
                <label className="text-[10px] font-black text-coral/50 uppercase tracking-widest block mb-2 ml-2">
                  Chỉ số CV
                </label>
                <input
                  type="text"
                  className="theme-input h-11 md:h-12 !py-2 font-black text-deep-teal text-sm md:text-base"
                  placeholder="0 Cv"
                  value={monthCv}
                  onChange={(e) =>
                    setMonthCv(formatCurrencyInput(e.target.value))
                  }
                />
              </div>
              <div className="col-span-2 md:col-span-5">
                <label className="text-[10px] font-black text-coral/50 uppercase tracking-widest block mb-2 ml-2">
                  Giá trị nhập đơn (VNĐ)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    className="theme-input h-11 md:h-12 !py-2 font-black text-red-500 text-sm md:text-base pr-8"
                    placeholder="0"
                    value={monthImport}
                    onChange={(e) =>
                      setMonthImport(formatCurrencyInput(e.target.value))
                    }
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500/30 font-black text-xs">
                    ₫
                  </span>
                </div>
              </div>
              <div className="col-span-2 md:col-span-9">
                <label className="text-[10px] font-black text-coral/50 uppercase tracking-widest block mb-2 ml-2">
                  Ghi chú chu kỳ
                </label>
                <input
                  type="text"
                  className="theme-input h-11 md:h-12 !py-2 font-bold text-xs md:text-sm"
                  placeholder="..."
                  value={monthNote}
                  onChange={(e) => setMonthNote(e.target.value)}
                />
              </div>
              <div className="col-span-2 md:col-span-3 flex items-end">
                <button
                  onClick={saveMonthly}
                  className="w-full h-11 md:h-12 bg-coral text-white rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-xl active:scale-95 transition-all tracking-widest"
                >
                  LƯU KẾT TOÁN
                </button>
              </div>
            </div>
          </div>
          <div className="md:hidden space-y-4 pb-4 max-h-[500px] overflow-y-auto hide-scrollbar">
            {groupedMonthlyStats
              .filter(
                (group) =>
                  !filterMonthlyYear ||
                  group.month.startsWith(filterMonthlyYear),
              )
              .map((group) => {
                const currentAcc = accs
                  .filter((a) => a.date.startsWith(group.month))
                  .reduce((s, a) => s + a.amount, 0);
                const remain = currentAcc - group.totalImport;
                return (
                  <div
                    key={group.month}
                    className="bg-white/80 rounded-[24px] p-4 border border-coral/10 shadow-sm relative"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <button
                        onClick={() => toggleMonth(group.month)}
                        className="flex items-center gap-2 font-black text-deep-teal"
                      >
                        {expandedMonths[group.month] ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                        {group.month}
                      </button>
                      <span className="text-[10px] font-bold text-deep-teal/40 bg-sky-50 px-2 py-1 rounded-lg">
                        {group.items.length} đợt
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <span className="text-[10px] font-black text-deep-teal/40 uppercase tracking-widest block">
                          CV Hệ thống
                        </span>
                        <span className="font-bold text-deep-teal/60 text-sm">
                          {group.totalCv.toLocaleString()} Cv
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-red-500/40 uppercase tracking-widest block">
                          Tiền nhập
                        </span>
                        <span className="font-bold text-red-500 text-sm">
                          {formatMoney(group.totalImport)}
                        </span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-deep-teal/5 flex justify-between items-end">
                        <span className="text-[10px] font-black text-deep-teal/50 uppercase tracking-widest">
                          Dư nợ
                        </span>
                        <span
                          className={cn(
                            "font-black tabular-nums font-mono text-base tracking-tighter",
                            remain >= 0 ? "text-emerald-500" : "text-red-500",
                          )}
                        >
                          {formatMoney(remain)}
                        </span>
                      </div>
                    </div>

                    {expandedMonths[group.month] && (
                      <div className="mt-4 space-y-2 border-t border-dashed border-deep-teal/10 pt-3">
                        {group.items.map((stat) => (
                          <div
                            key={stat.id}
                            className="bg-sky-50/50 rounded-[16px] p-3 flex flex-col gap-2 relative"
                          >
                            <div className="flex justify-between items-start">
                              <p className="text-xs text-deep-teal/60 flex-1 font-medium">
                                {stat.note || "Không có ghi chú"}
                              </p>
                              {confirmingDeleteMonthlyId === stat.id ? (
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <button
                                    onClick={() => deleteMonthly(stat)}
                                    className="px-2 py-1 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                                  >
                                    Xóa
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmingDeleteMonthlyId(null)
                                    }
                                    className="px-2 py-1 bg-white border border-sky-100 text-deep-teal rounded-lg text-[10px] font-black uppercase tracking-wider"
                                  >
                                    Hủy
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    setConfirmingDeleteMonthlyId(stat.id)
                                  }
                                  className="text-red-400 p-1 bg-white rounded-md shadow-sm shrink-0 ml-2"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <div className="flex justify-between items-center bg-white/50 px-2 py-1.5 rounded-lg">
                              <span className="text-[10px] font-bold text-deep-teal/50 uppercase tracking-widest">
                                {stat.cv.toLocaleString()} Cv
                              </span>
                              <span className="text-[11px] font-black text-coral">
                                {formatMoney(stat.importAmt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="hidden md:block overflow-x-auto hide-scrollbar max-h-[500px]">
            <table className="w-full text-left">
              <thead>
                <tr className="text-deep-teal/40 text-[10px] uppercase font-black tracking-[0.2em] border-b border-deep-teal/5">
                  <th className="py-6 px-4">Kỳ tháng</th>
                  <th className="py-6 px-4 text-right">CV Hệ thống</th>
                  <th className="py-6 px-4 text-right">Tiền nhập</th>
                  <th className="py-6 px-4 text-right">Dư nợ</th>
                  <th className="py-6 px-4 text-center">Lệnh</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {groupedMonthlyStats
                  .filter(
                    (group) =>
                      !filterMonthlyYear ||
                      group.month.startsWith(filterMonthlyYear),
                  )
                  .map((group) => {
                    const currentAcc = accs
                      .filter((a) => a.date.startsWith(group.month))
                      .reduce((s, a) => s + a.amount, 0);
                    const remain = currentAcc - group.totalImport;
                    return (
                      <React.Fragment key={group.month}>
                        <tr className="bg-sky-50/30 border-t border-deep-teal/5">
                          <td className="py-3 px-4 font-black text-deep-teal">
                            <button
                              onClick={() => toggleMonth(group.month)}
                              className="flex items-center gap-2 hover:text-coral transition-colors"
                            >
                              {expandedMonths[group.month] ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                              {group.month}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-deep-teal/50">
                            {group.totalCv.toLocaleString()} Cv
                          </td>
                          <td className="py-3 px-4 text-right font-black text-red-500">
                            {formatMoney(group.totalImport)}
                          </td>
                          <td
                            className={cn(
                              "py-3 px-4 text-right font-black tabular-nums font-mono text-[15px]",
                              remain >= 0 ? "text-emerald-500" : "text-red-500",
                            )}
                          >
                            {formatMoney(remain)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-[10px] font-bold text-deep-teal/40 bg-white px-2 py-1 rounded-lg">
                              {group.items.length} đợt
                            </span>
                          </td>
                        </tr>
                        {expandedMonths[group.month] &&
                          group.items.map((stat) => (
                            <tr
                              key={stat.id}
                              className="group border-t border-dashed border-deep-teal/10 hover:bg-deep-teal/5 transition-colors"
                            >
                              <td className="py-3 px-4 pl-8 text-xs text-deep-teal/60">
                                {stat.note || "Không có ghi chú"}
                              </td>
                              <td className="py-3 px-4 text-right text-xs font-bold text-deep-teal/40">
                                {stat.cv.toLocaleString()} Cv
                              </td>
                              <td className="py-3 px-4 text-right text-xs font-bold text-coral">
                                {formatMoney(stat.importAmt)}
                              </td>
                              <td className="py-3 px-4"></td>
                              <td className="py-3 px-4 text-center">
                                {confirmingDeleteMonthlyId === stat.id ? (
                                  <div className="flex items-center justify-center gap-1 animate-in fade-in zoom-in duration-200">
                                    <button
                                      onClick={() => deleteMonthly(stat)}
                                      className="px-2 py-1 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-600 transition-colors shadow-sm"
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirmingDeleteMonthlyId(null)
                                      }
                                      className="px-2 py-1 bg-white border border-sky-100 text-deep-teal rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-sky-50 transition-colors shadow-sm"
                                    >
                                      Hủy
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setConfirmingDeleteMonthlyId(stat.id)
                                    }
                                    className="w-8 h-8 rounded-lg bg-white border border-sky-100 shadow-sm text-red-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all mx-auto group/btn"
                                  >
                                    <Trash2
                                      size={14}
                                      className="transition-transform group-hover/btn:scale-110"
                                    />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
