import { getTenantCollection, getTenantDoc } from "../lib/tenant";
import React, { useState, useEffect, useMemo } from "react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { Order, CVAccumulation, CVMonthlyStat } from "../types";
import { useAuth } from "../AuthProvider";
import { formatMoney, cn } from "../lib/utils";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart, Bar as RechartsBar 
} from 'recharts';
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  PieChart as PieIcon,
  Search,
  Filter,
  User,
  BadgeCheck,
  Bomb,
  Trash2,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export const AnalyticsView: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [cvAccs, setCvAccs] = useState<CVAccumulation[]>([]);
  const [loading, setLoading] = useState(true);
  const getLocalDateString = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const [start, setStart] = useState(
    getLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [end, setEnd] = useState(getLocalDateString(new Date()));

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    // We fetch all orders for simple logic since it's a small app
    const q = getTenantCollection("orders", user);
    console.log(`[Analytics] Listening to orders collection: ${q.path}`);
    return onSnapshot(
      q,
      (snapshot) => {
        setOrders(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Order),
        );
      },
      (err) => {
        console.error("[Analytics] Orders error:", err);
      },
    );
  }, [user]);

  useEffect(() => {
    if (!user) {
      setCvAccs([]);
      setLoading(false);
      return;
    }
    const q = getTenantCollection("cv_accumulations", user);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCvAccs(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as CVAccumulation,
          ),
        );
        setLoading(false);
      },
      (err) => {
        console.error("[Analytics] CV error:", err);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [user]);

  const stats = useMemo(() => {
    console.log(`[Analytics] Recalculating stats. orders.length: ${orders.length}, cvAccs.length: ${cvAccs.length}, period: ${start} to ${end}`);
    const allOrdersInPeriod = orders.filter((o) => {
      const date = o.orderDate || o.shipDate;
      return date >= start && date <= end;
    });

    console.log(`[Analytics] Orders in period: ${allOrdersInPeriod.length}`);

    const filteredOrders = allOrdersInPeriod.filter((o) => o && !["Đã Hủy", "Đơn BOM 💣"].includes(o.status || ""));
    
    let sOut = 0,
      sVnl = 0,
      sNew = 0,
      sTtd = 0,
      totalRev = 0,
      collected = 0,
      totalQty = 0;
    const dailyRev: { [key: string]: number } = {};

    filteredOrders.forEach((o) => {
      const net = (Number(o.total) || 0) - (Number(o.shipFee) || 0);
      if (!isNaN(net)) {
        totalRev += net;
        if (o.isPaid) collected += net;
      }

      const date = o.orderDate || o.shipDate || "unknown";
      if (!isNaN(net)) {
        dailyRev[date] = (dailyRev[date] || 0) + net;
      }

      (o.products || []).forEach((p) => {
        const pQty = Number(p.qty) || 0;
        const pPrice = Number(p.price) || 0;
        const itemTotal = pPrice * pQty;
        
        totalQty += pQty;
        const productName = (p.name || "").toUpperCase();
        const OUT_KEYWORDS = ["BND", "BNĐ", "NƯỚC HOA", "SERUM"];
        const isOutside = OUT_KEYWORDS.some((k) =>
          productName.includes(k.toUpperCase()),
        );

        if (isOutside) {
          if (!isNaN(itemTotal)) sOut += itemTotal;
        } else {
          if (!isNaN(itemTotal)) sVnl += itemTotal;
        }
      });

      const subtotal = Number(o.subtotal) || 0;
      if (!isNaN(subtotal)) {
        if (o.customerType === "ttd") sTtd += subtotal;
        else sNew += subtotal;
      }
    });

    const bomOrders = allOrdersInPeriod.filter((o) => o.status === "Đơn BOM 💣");
    const failedOrders = allOrdersInPeriod.filter((o) => ["Đã Hủy", "Đơn BOM 💣"].includes(o.status || ""));

    const bomTotal = bomOrders.reduce((sum, o) => {
      const t = Number(o.total) || 0;
      return sum + (isNaN(t) ? 0 : t);
    }, 0);

    const sAcc = cvAccs
      .filter((a) => a && a.date && a.date >= start && a.date <= end)
      .reduce((sum, a) => {
        const amt = Number(a.amount) || 0;
        return sum + (isNaN(amt) ? 0 : amt);
      }, 0);

    const successRate = allOrdersInPeriod.length > 0 ? (filteredOrders.length / allOrdersInPeriod.length) * 100 : 0;
    const cancelRate = allOrdersInPeriod.length > 0 ? (failedOrders.length / allOrdersInPeriod.length) * 100 : 0;

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const last3MonthsStartStr = getLocalDateString(threeMonthsAgo);

    const productSales: { [key: string]: { qty: number, revenue: number } } = {};
    orders.forEach((o) => {
      const date = o.orderDate || o.shipDate;
      const isFailed = ["Đã Hủy", "Đơn BOM 💣"].includes(o.status);
      if (date >= last3MonthsStartStr && !isFailed) {
        o.products.forEach((p) => {
          if (!productSales[p.name]) productSales[p.name] = { qty: 0, revenue: 0 };
          productSales[p.name].qty += p.qty;
          // Sort condition mentioned: "dự trên số lượng sản phẩm bán ra và doanh số mang về" -> meaning it will show both, and sort by qty or revenue. We will keep both and sort by revenue.
          productSales[p.name].revenue += (p.price * p.qty);
        });
      }
    });
    
    const allProducts = Object.entries(productSales)
      .map(([name, data]) => ({ 
        name: name.length > 20 ? name.substring(0, 20) + '...' : name, 
        ...data 
      }));

    const topProductsByRevenue = [...allProducts]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const topProductsByQty = [...allProducts]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const orderCount = filteredOrders.length;
    const averageOrderValue = orderCount > 0 ? totalRev / orderCount : 0;

    return {
      sOut,
      sVnl,
      sNew,
      sTtd,
      totalRev,
      collected,
      bomTotal,
      bomCount: bomOrders.length,
      failedCount: failedOrders.length,
      orderCount,
      sAcc,
      dailyRev,
      topProductsByRevenue,
      topProductsByQty,
      averageOrderValue,
      successRate,
      cancelRate,
      totalQty,
    };
  }, [orders, cvAccs, start, end]);

  const chartData = {
    labels: Object.keys(stats.dailyRev)
      .sort()
      .map((d) => d.split("-").reverse().slice(0, 2).join("/")),
    datasets: [
      {
        label: "Doanh thu",
        data: Object.keys(stats.dailyRev)
          .sort()
          .map((d) => stats.dailyRev[d]),
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return "rgba(3, 76, 95, 0.8)";
          const gradient = ctx.createLinearGradient(
            0,
            chartArea.bottom,
            0,
            chartArea.top,
          );
          gradient.addColorStop(0, "rgba(238, 100, 87, 0.2)"); // color coral transparent
          gradient.addColorStop(1, "rgba(238, 100, 87, 1)"); // coral solid
          return gradient;
        },
        borderColor: "#EE6457",
        borderWidth: 0,
        borderRadius: 6,
        hoverBackgroundColor: "#EE6457",
      },
    ],
  };

  const ratioData = {
    labels: ["DOANH SỐ NGOÀI", "DOANH SỐ VNL"],
    datasets: [
      {
        data: [stats.sOut, stats.sVnl],
        backgroundColor: ["#EE6457", "#034C5F"],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const customerData = {
    labels: ["KHÁCH MỚI", "KHÁCH TTD"],
    datasets: [
      {
        data: [stats.sNew, stats.sTtd],
        backgroundColor: ["#EE6457", "#034C5F"],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Activity size={48} className="text-emerald-500 animate-pulse" />
        <p className="text-sm font-black text-deep-teal/40 uppercase tracking-widest animate-pulse">
          Đang tải dữ liệu báo cáo...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header & Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <Activity className="text-sky-500" />
            <span className="tracking-tight">Bảng Điều Khiển</span>
          </h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">Tổng quan hiệu suất kinh doanh</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60 w-full sm:w-auto">
            <input
              type="date"
              className="bg-white px-3 py-2 rounded-xl outline-none text-xs font-bold text-slate-700 uppercase tracking-tight cursor-pointer shadow-sm border border-slate-100 flex-1 sm:flex-none"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <span className="text-slate-300 font-black hidden sm:block">-</span>
            <input
              type="date"
              className="bg-white px-3 py-2 rounded-xl outline-none text-xs font-bold text-slate-700 uppercase tracking-tight cursor-pointer shadow-sm border border-slate-100 flex-1 sm:flex-none"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
        </div>
      </div>

      {/* 2. Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Doanh số */}
        <div className="bg-white rounded-[24px] p-5 lg:p-6 border border-sky-100 shadow-lg shadow-sky-50 flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          
          <div className="flex justify-between items-start relative z-10 mb-2">
            <span className="text-[10px] md:text-[11px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={14} className="text-sky-500" />
              TỔNG SALE
            </span>
          </div>

          <div className="relative z-10 flex items-baseline gap-2">
            <div className="text-2xl lg:text-3xl font-black text-slate-800 group-hover:text-sky-600 transition-colors tracking-tighter">
              {formatMoney(stats.totalRev)}
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-500 mt-4 relative z-10 space-y-2">
            <div className="flex items-center justify-between bg-sky-50/50 p-2 rounded-xl">
              <span className="text-sky-600 flex items-center gap-1.5">
                <Filter size={12} />
                Số lượng đơn:
              </span>
              <span className="bg-sky-100 text-sky-600 px-2 py-0.5 rounded-lg font-black">{stats.orderCount}</span>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px]">
              <span className="text-slate-400 font-bold uppercase tracking-tight">Giá trị TB/Đơn:</span>
              <span className="text-sky-500 font-black">{formatMoney(stats.averageOrderValue)}</span>
            </div>
          </div>
        </div>

        {/* Chốt thu */}
        <div className="bg-white rounded-[24px] p-5 lg:p-6 border border-emerald-100 shadow-lg shadow-emerald-50 flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          
          <div className="flex justify-between items-start relative z-10 mb-2">
            <span className="text-[10px] md:text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <BadgeCheck size={14} className="text-emerald-500" />
              ĐÃ CHỐT THU
            </span>
          </div>

          <div className="relative z-10">
            <div className="text-2xl lg:text-3xl font-black text-emerald-600 tracking-tighter">
              {formatMoney(stats.collected)}
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-500 mt-4 relative z-10 space-y-2">
            <div className="flex items-center justify-between bg-emerald-50/50 p-2 rounded-xl">
              <span className="text-emerald-600 flex items-center gap-1.5">
                <DollarSign size={12} />
                Thu nhập:
              </span>
              <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-lg font-black">
                {formatMoney(stats.collected - stats.sAcc)}
              </span>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px]">
              <span className="text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> Chi phí tích lũy:
              </span>
              <span className="text-slate-600 font-black italic">{formatMoney(stats.sAcc)}</span>
            </div>
          </div>
        </div>

        {/* Thành công */}
        <div className="bg-white rounded-[24px] p-5 lg:p-6 border border-indigo-100 shadow-lg shadow-indigo-50 flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          
          <div className="flex justify-between items-start relative z-10 mb-2">
            <span className="text-[10px] md:text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-500" />
              SL ĐÃ BÁN
            </span>
          </div>

          <div className="relative z-10 flex items-baseline gap-2">
            <div className="text-2xl lg:text-3xl font-black text-indigo-600 tracking-tighter">
              {stats.totalQty} <span className="text-sm text-indigo-400">sp</span>
            </div>
          </div>

          <div className="text-[11px] font-bold text-slate-500 mt-4 relative z-10 space-y-2">
            <div className="flex items-center justify-between bg-indigo-50/50 p-2 rounded-xl">
              <span className="text-indigo-600 flex items-center gap-1.5">
                <BadgeCheck size={12} />
                Tỉ lệ thành công:
              </span>
              <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-lg font-black">
                {stats.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px]">
              <span className="text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1">
                Hiệu suất xử lý
              </span>
              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all" 
                  style={{ width: `${stats.successRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Thất bại / BOM */}
        <div className="bg-white rounded-[24px] p-5 lg:p-6 border border-rose-100 shadow-lg shadow-rose-50 flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
          
          <div className="flex justify-between items-start relative z-10 mb-2">
            <span className="text-[10px] md:text-[11px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
              <Bomb size={14} className="text-rose-500" />
              TỈ LỆ HỦY/BOM
            </span>
          </div>

          <div className="relative z-10 flex items-baseline gap-2">
            <div className="text-2xl lg:text-3xl font-black text-rose-500 tracking-tighter">
              {stats.cancelRate.toFixed(1)}%
            </div>
            <span className="text-[10px] font-bold text-rose-300">trên tổng đơn</span>
          </div>

          <div className="text-[11px] font-bold text-slate-500 mt-4 relative z-10 space-y-2">
            <div className="flex items-center justify-between bg-rose-50/50 p-2 rounded-xl">
              <span className="flex items-center gap-1.5 text-rose-600">
                <Trash2 size={12} />
                Tổng hủy/BOM:
              </span>
              <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-lg font-black">{stats.failedCount}</span>
            </div>
            
            <div className="flex items-center justify-between text-[10px] px-1">
              <div className="flex items-center gap-1 text-rose-400/80">
                <Bomb size={10} />
                Riêng BOM: <span className="text-rose-500 font-black">{stats.bomCount}</span>
              </div>
              <div className="text-rose-600 font-black italic">
                - {formatMoney(stats.bomTotal)} Loss
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Charts Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Main Bar Chart */}
        <div className="xl:col-span-2 bg-white rounded-[24px] p-5 lg:p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-black text-slate-800 text-sm md:text-base flex items-center gap-2">
              <span className="w-1.5 h-6 bg-sky-400 rounded-full"></span>
              Biểu đồ doanh thu
            </h3>
          </div>
          <div className="flex-1 min-h-[250px] w-full">
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    backgroundColor: "#0ea5e9",
                    titleFont: { size: 12, weight: "bold" as const, family: "Inter" },
                    bodyFont: { size: 15, weight: "bold" as const, family: "Inter" },
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: false,
                    callbacks: {
                      title: (context) => {
                        const index = context[0].dataIndex;
                        const dateKeys = Object.keys(stats.dailyRev).sort();
                        return dateKeys[index].split("-").reverse().join("/");
                      },
                      label: (context) => formatMoney(context.raw as number),
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: "#f1f5f9" },
                    border: { display: false },
                    ticks: { font: { size: 10, weight: "bold" } as any, color: "#94a3b8" },
                  },
                  x: {
                    grid: { display: false },
                    ticks: { font: { size: 10, weight: "bold" } as any, color: "#94a3b8" },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Doughnut Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-5">
          <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm flex flex-col">
            <h3 className="font-black text-slate-800 text-[13px] flex items-center gap-2 mb-4">
              Tỷ lệ Doanh số
            </h3>
            <div className="flex-1 min-h-[140px] flex items-center justify-center relative">
              {stats.sOut + stats.sVnl > 0 ? (
                <Doughnut
                  data={ratioData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "right", labels: { font: { family: "Inter", weight: "bold" as const, size: 10 }, boxWidth: 10 } },
                      tooltip: { backgroundColor: "#334155", titleFont: { family: "Inter" } }
                    },
                  }}
                />
              ) : (
                <div className="text-slate-400 font-bold text-xs">Chưa có dữ liệu</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-5 border border-slate-100 shadow-sm flex flex-col">
            <h3 className="font-black text-slate-800 text-[13px] flex items-center gap-2 mb-4">
              Tỷ lệ Khách hàng
            </h3>
            <div className="flex-1 min-h-[140px] flex items-center justify-center relative">
              {stats.sNew + stats.sTtd > 0 ? (
                <Doughnut
                  data={customerData}
                  options={{
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: "right", labels: { font: { family: "Inter", weight: "bold" as const, size: 10 }, boxWidth: 10 } },
                      tooltip: { backgroundColor: "#334155", titleFont: { family: "Inter" } }
                    },
                  }}
                />
              ) : (
                <div className="text-slate-400 font-bold text-xs">Chưa có dữ liệu</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Sub Categories (Out, VNL, New, TTD) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> DS NGOÀI</span>
          <div className="text-lg md:text-xl font-black text-slate-700 mt-2">{formatMoney(stats.sOut)}</div>
        </div>
        <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> DS VNL</span>
          <div className="text-lg md:text-xl font-black text-slate-700 mt-2">{formatMoney(stats.sVnl)}</div>
        </div>
        <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-300"></span> KHÁCH MỚI</span>
          <div className="text-lg md:text-xl font-black text-slate-700 mt-2">{formatMoney(stats.sNew)}</div>
        </div>
        <div className="bg-white rounded-[20px] p-4 border border-slate-100 shadow-sm flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> KHÁCH TTD</span>
          <div className="text-lg md:text-xl font-black text-slate-700 mt-2">{formatMoney(stats.sTtd)}</div>
        </div>
      </div>

      {/* 5. Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top Products by Revenue */}
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5 lg:p-6 relative overflow-hidden flex flex-col">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-6 relative z-10">
              <span className="w-1.5 h-5 bg-indigo-500 rounded-full"></span>
              Top theo Doanh thu (3 Tháng)
            </h3>
            <div className="h-[280px] w-full min-w-[200px] relative z-10 overflow-hidden">
              {stats.topProductsByRevenue.length > 0 ? (
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart style={{ outline: 'none' }} data={stats.topProductsByRevenue} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                        return value;
                      }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                      width={80}
                    />
                    <RechartsTooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(value: any, name: any, props: any) => [formatMoney(value), 'Doanh thu']}
                    />
                    <RechartsBar 
                      dataKey="revenue" 
                      fill="url(#revenueGradient)" 
                      radius={[0, 6, 6, 0]}
                      barSize={16}
                      activeBar={false}
                      label={{ position: 'right', fill: '#4f46e5', fontSize: 10, fontWeight: 'bold', formatter: formatMoney }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                  Chưa có dữ liệu sản phẩm
                </div>
              )}
            </div>
          </div>

          {/* Top Products by Qty */}
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-5 lg:p-6 relative overflow-hidden flex flex-col">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 mb-6 relative z-10">
              <span className="w-1.5 h-5 bg-emerald-500 rounded-full"></span>
              Top theo Số lượng (3 Tháng)
            </h3>
            <div className="h-[280px] w-full min-w-[200px] relative z-10 overflow-hidden">
              {stats.topProductsByQty.length > 0 ? (
                <ResponsiveContainer width="99%" height="100%">
                  <BarChart style={{ outline: 'none' }} data={stats.topProductsByQty} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="qtyGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }}
                      width={80}
                    />
                    <RechartsTooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '12px' }}
                      formatter={(value: any, name: any, props: any) => [`${value} SP`, 'Số lượng']}
                    />
                    <RechartsBar 
                      dataKey="qty" 
                      fill="url(#qtyGradient)" 
                      radius={[0, 6, 6, 0]}
                      barSize={16}
                      activeBar={false}
                      label={{ position: 'right', fill: '#059669', fontSize: 10, fontWeight: 'bold', formatter: (val: any) => `${val}` }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                  Chưa có dữ liệu sản phẩm
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};
