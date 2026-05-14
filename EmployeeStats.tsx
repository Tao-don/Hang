import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { UserProfile, Order, CVAccumulation } from '../types';
import { BarChart3, Users, FileText, Package2, CalendarDays, DollarSign, Loader2, Calendar, Gift, TrendingUp, Focus, Sparkles } from 'lucide-react';

interface EmployeeStat {
  uid: string;
  email: string;
  displayName: string;
  joinDate?: string;
  birthday?: string;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  sOut: number;
  sVnl: number;
  sNew: number;
  sTtd: number;
  collected: number;
  cvTich: number;
}

export const EmployeeStats: React.FC = () => {
  const [stats, setStats] = useState<EmployeeStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetMonth, setTargetMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
        const employees: UserProfile[] = usersSnap.docs.map(d => d.data() as UserProfile);

        const statsData: EmployeeStat[] = [];
        const start = `${targetMonth}-01`;
        const end = `${targetMonth}-31`;

        for (const emp of employees) {
          const ordersPath = `users/${emp.uid}/orders`;
          const customersPath = `users/${emp.uid}/customers`;
          const cvPath = `users/${emp.uid}/cv_accumulations`;

          const [ordersSnap, customersSnap, cvSnap] = await Promise.all([
            getDocs(collection(db, ordersPath)),
            getDocs(collection(db, customersPath)),
            getDocs(collection(db, cvPath)),
          ]);

          let totalRevenue = 0;
          let sOut = 0;
          let sVnl = 0;
          let sNew = 0;
          let sTtd = 0;
          let collected = 0;
          let cvTich = 0;
          let totalOrders = 0;
          let newCustomers = 0;

          const OUT_KEYWORDS = ["BND", "BNĐ", "NƯỚC HOA", "SERUM"];

          ordersSnap.forEach(doc => {
            const o = doc.data() as Order;
            const date = o.orderDate || o.shipDate;
            const isFailed = ["Đã Hủy", "Đơn BOM 💣"].includes(o.status);

            if (date >= start && date <= end && !isFailed) {
              totalOrders++;
              const net = o.total - o.shipFee;
              totalRevenue += net;
              if (o.isPaid) collected += net;
              
              if (o.customerType !== "ttd") newCustomers++;

              o.products?.forEach((p) => {
                const itemTotal = p.price * p.qty;
                const productName = p.name.toUpperCase();
                const isOutside = OUT_KEYWORDS.some((k) =>
                  productName.includes(k.toUpperCase()),
                );

                if (isOutside) {
                  sOut += itemTotal;
                } else {
                  sVnl += itemTotal;
                }
              });

              if (o.customerType === "ttd") sTtd += o.subtotal;
              else sNew += o.subtotal;
            }
          });

          cvSnap.forEach((doc) => {
            const a = doc.data() as CVAccumulation;
            if (a.date >= start && a.date <= end) {
              cvTich += a.amount;
            }
          });

          statsData.push({
            uid: emp.uid,
            email: emp.email,
            displayName: emp.displayName || 'Chưa cập nhật tên',
            joinDate: emp.joinDate,
            birthday: emp.birthday,
            totalOrders,
            totalRevenue,
            totalCustomers: newCustomers,
            sOut,
            sVnl,
            sNew,
            sTtd,
            collected,
            cvTich
          });
        }

        if (isMounted) setStats(statsData);
      } catch (error) {
        console.error('Error fetching employee stats:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, [targetMonth]);

  return (
    <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-10 relative overflow-hidden flex flex-col gap-8">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-50/50 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10">
        <div>
          <h3 className="text-xl font-black text-deep-teal tracking-tight flex items-center gap-3 mb-1">
            Hiệu Suất Nhà Phân Phối <TrendingUp size={20} className="text-emerald-500" />
          </h3>
          <p className="text-xs font-semibold text-slate-500">
            Xem báo cáo doanh số, đơn hàng và thu nhập theo từng cá nhân.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200/60 shadow-sm shrink-0 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm text-emerald-600">
            <CalendarDays size={18} />
          </div>
          <input 
            type="month" 
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="bg-transparent border-none outline-none font-bold text-deep-teal pr-4 pl-1"
          />
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-emerald-500 gap-4">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-xs font-semibold text-slate-400">Đang tổng hợp dữ liệu...</p>
        </div>
      ) : (
        <div className="relative z-10 mt-2">
          {stats.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 border border-slate-100 border-dashed rounded-[32px]">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 text-slate-300">
                <Users size={24} />
              </div>
              <p className="text-deep-teal/40 font-bold text-sm">Chưa có dữ liệu nhà phân phối trong tháng này</p>
            </div>
          ) : (
            <>
              {/* Desktop View - Modern Table */}
              <div className="hidden xl:block overflow-x-auto bg-white rounded-[24px] border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                      <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-slate-500">Nhà phân phối</th>
                      <th className="py-5 px-4 font-black text-[10px] uppercase tracking-widest text-slate-500 text-right">DS VNL / Ngoài</th>
                      <th className="py-5 px-4 font-black text-[10px] uppercase tracking-widest text-slate-500 text-right">DS TTD / Mới</th>
                      <th className="py-5 px-4 font-black text-[10px] uppercase tracking-widest text-slate-500 text-center">Khách & Đơn</th>
                      <th className="py-5 px-4 font-black text-[10px] uppercase tracking-widest text-slate-500 text-right">Đã Thu (CV)</th>
                      <th className="py-5 px-6 font-black text-[10px] uppercase tracking-widest text-emerald-600 text-right">Thu Nhập Ròng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.map((stat) => {
                      const income = stat.collected - stat.cvTich;
                      return (
                        <tr key={stat.uid} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100/50 text-emerald-600 flex items-center justify-center font-black shadow-sm group-hover:scale-105 transition-transform">
                                {stat.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-bold text-deep-teal text-[14px]">{stat.displayName}</h4>
                                <p className="text-[11px] font-medium text-slate-400">{stat.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-deep-teal text-[14px]">{stat.sVnl.toLocaleString()}</span>
                              <span className="text-[11px] text-slate-400 font-medium">Ngoài: {stat.sOut.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-indigo-700 text-[14px]">{stat.sTtd.toLocaleString()}</span>
                              <span className="text-[11px] text-sky-600/70 font-medium">Mới: {stat.sNew.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100/60">
                              <div className="flex items-center gap-1.5" title="Khách Mới">
                                <Users size={12} className="text-pink-500" />
                                <span className="font-bold text-pink-600 text-[13px]">{stat.totalCustomers}</span>
                              </div>
                              <div className="w-px h-3 bg-slate-200"></div>
                              <div className="flex items-center gap-1.5" title="Tổng Đơn">
                                <Package2 size={12} className="text-purple-500" />
                                <span className="font-bold text-purple-600 text-[13px]">{stat.totalOrders}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-bold text-blue-600 text-[14px]">{stat.collected.toLocaleString()}</span>
                              <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/50">CV: {stat.cvTich.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                             <div className="inline-flex flex-col items-end">
                               <span className="font-black text-emerald-600 text-[16px] xl:text-[18px] tracking-tight">{income.toLocaleString()} ₫</span>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View - Elegant Cards */}
              <div className="xl:hidden grid grid-cols-1 gap-5">
                {stats.map((stat) => {
                  const income = stat.collected - stat.cvTich;
                  return (
                    <div key={stat.uid} className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      <div className="px-5 py-4 bg-slate-50/50 flex justify-between items-center border-b border-slate-100">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100/50 text-emerald-600 flex items-center justify-center font-black shadow-sm">
                             {stat.displayName.charAt(0).toUpperCase()}
                           </div>
                           <div>
                             <h4 className="font-bold text-deep-teal text-[15px]">{stat.displayName}</h4>
                             <p className="text-[11px] font-medium text-slate-400">{stat.email}</p>
                           </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 mb-0.5">Thu Nhập</span>
                           <span className="font-black text-emerald-600 text-lg tracking-tight">{income.toLocaleString()} ₫</span>
                        </div>
                      </div>

                      <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-4">
                        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">DS VNL</span>
                           <span className="font-bold text-deep-teal text-sm">{stat.sVnl.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">DS Ngoài</span>
                           <span className="font-bold text-slate-600 text-sm">{stat.sOut.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/70">DS TTD</span>
                           <span className="font-bold text-indigo-700 text-sm">{stat.sTtd.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-sky-600/70">DS Mới</span>
                           <span className="font-bold text-sky-700 text-sm">{stat.sNew.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-blue-600/70">Đã Thu</span>
                           <span className="font-bold text-blue-600 text-sm">{stat.collected.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                           <span className="text-[10px] font-black uppercase tracking-widest text-amber-600/70">Tích Lũy</span>
                           <span className="font-bold text-amber-600 text-sm">{stat.cvTich.toLocaleString()}</span>
                        </div>

                        <div className="col-span-2 pt-2 flex items-center justify-center gap-6">
                           <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-pink-50 flex items-center justify-center">
                               <Users size={14} className="text-pink-500" />
                             </div>
                             <div className="flex flex-col">
                               <span className="font-bold text-pink-600 text-[14px] leading-none">{stat.totalCustomers}</span>
                               <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">Khách Mới</span>
                             </div>
                           </div>
                           <div className="w-px h-8 bg-slate-100"></div>
                           <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                               <Package2 size={14} className="text-purple-500" />
                             </div>
                             <div className="flex flex-col">
                               <span className="font-bold text-purple-600 text-[14px] leading-none">{stat.totalOrders}</span>
                               <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">Tổng Đơn</span>
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};


