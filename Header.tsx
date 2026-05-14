import { getTenantCollection, getTenantDoc } from "../lib/tenant";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../AuthProvider";
import { auth, db } from "../lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
  query,
} from "firebase/firestore";
import {
  ShoppingCart,
  PieChart,
  Users,
  Star,
  Warehouse,
  Bell,
  Settings,
  LogOut,
  User as UserIcon,
  LogIn,
  Download,
  Upload,
  LayoutDashboard,
  Cake,
  Heart,
  BellOff,
  Calendar,
  Phone,
  ChevronRight,
} from "lucide-react";
import { cn, showToast } from "../lib/utils";
import { Customer } from "../types";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuth,
}) => {
  const { user, profile, isAdmin } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setShowSettings(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(getTenantCollection("customers", user));
    return onSnapshot(q, (snapshot) => {
      const customers = snapshot.docs.map((doc) => doc.data() as Customer);
      const today = new Date();
      const currentMonth = (today.getMonth() + 1).toString().padStart(2, "0");
      const events: any[] = [];

      customers.forEach((c) => {
        if (c.birthday && c.birthday.split("/")[1] === currentMonth) {
          events.push({
            type: "birthday",
            name: c.name,
            date: c.birthday,
            phone: c.phone,
          });
        }
        if (c.anniversary && c.anniversary.split("/")[1] === currentMonth) {
          events.push({
            type: "anniversary",
            name: c.name,
            date: c.anniversary,
            phone: c.phone,
          });
        }
      });
      setNotifications(events);
    });
  }, [user]);

  const handleBackup = async () => {
    // In a real Firestore app, we'd need to fetch all collections.
    // For this app, we'll fetch the most important ones.
    const collections = [
      "orders",
      "customers",
      "inventory",
      "cv_accumulations",
      "cv_monthly",
    ];
    const data: any = {};

    for (const col of collections) {
      const snap = await getDocs(getTenantCollection(col, user));
      data[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BNDShop_Backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    showToast("Đã tải xuống file sao lưu!");
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    e.target.value = ""; // Reset input
  };

  const confirmRestore = async () => {
    if (!restoreFile) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result as string);
        showToast("Đang khôi phục dữ liệu...");

        for (const col in data) {
          const items = data[col];
          for (const item of items) {
            const { id, ...rest } = item;
            await setDoc(getTenantDoc(col, id, user), rest);
          }
        }
        showToast("Khôi phục hoàn tất!");
        setRestoreFile(null);
      } catch (err) {
        console.error(err);
        showToast("Lỗi khi đọc file backup!");
      }
    };
    reader.readAsText(restoreFile);
  };

  const tabs = [
    { id: "orders", label: "Đơn", icon: ShoppingCart },
    { id: "analytics", label: "Báo cáo", icon: PieChart },
    { id: "customers", label: "Khách", icon: Users },
    { id: "cv", label: "CV", icon: Star },
    { id: "inventory", label: "Kho", icon: Warehouse },
  ];

  return (
    <>
      <header className="h-12 md:h-20 bg-white/70 backdrop-blur-md border-b border-deep-teal/5 flex items-center px-4 md:px-8 z-40 sticky top-0">
        <div className="mx-auto flex items-center justify-between max-w-[1700px] w-full">
          {/* Logo / Dashboard Link */}
          <div
            className="flex items-center gap-2 md:gap-3 cursor-pointer group transition-all"
            onClick={() => setActiveTab("orders")}
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-deep-teal to-teal-700 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-all duration-300">
              <LayoutDashboard
                size={22}
                className="text-white md:size-[26px]"
              />
            </div>
            <div className="flex flex-col -gap-1">
              <span className="text-sm md:text-xl font-black text-deep-teal tracking-tighter uppercase leading-none">
                BNDShop
              </span>
              <span className="text-[9px] md:text-[10px] font-black text-coral uppercase tracking-widest flex items-center gap-1.5 translate-y-[2px]">
                DASHBOARD{" "}
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 p-1.5 bg-deep-teal/5 rounded-[22px] border border-white/50 shadow-inner">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative px-6 py-3 rounded-2xl font-black text-xs md:text-sm transition-all duration-500 flex items-center gap-2.5 overflow-hidden shrink-0 group/tab",
                    isActive
                      ? "text-deep-teal"
                      : "text-deep-teal/30 hover:text-deep-teal/60",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white shadow-md border border-deep-teal/10 rounded-2xl z-0"
                      transition={{
                        type: "spring",
                        bounce: 0.25,
                        duration: 0.6,
                      }}
                    />
                  )}
                  <tab.icon
                    size={18}
                    className={cn(
                      "relative z-10 transition-all duration-500",
                      isActive
                        ? "text-coral scale-110"
                        : "group-hover/tab:scale-110",
                    )}
                  />
                  <span className="relative z-10 uppercase tracking-widest">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 md:gap-4 shrink-0">
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl text-deep-teal/60 hover:bg-deep-teal/5 transition-all relative group"
              >
                <Bell
                  size={22}
                  className="relative z-10 group-hover:animate-bounce-short"
                />
                {notifications.length > 0 && (
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-coral rounded-full border-2 border-white shadow-lg z-20 animate-ping ring-2 ring-coral/20"></span>
                )}
                {notifications.length > 0 && (
                  <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-coral rounded-full border-2 border-white shadow-lg z-20"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-3xl rounded-[32px] shadow-[0_20px_60px_-10px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)] overflow-hidden z-[60] animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="px-6 py-5 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100 flex justify-between items-center relative overflow-hidden">
                    {/* Decorative element */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 bg-coral/5 rounded-full blur-2xl"></div>
                    <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-sky-400/10 rounded-full blur-xl"></div>

                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-8 h-8 rounded-full bg-deep-teal/10 flex items-center justify-center text-deep-teal">
                        <Bell size={16} />
                      </div>
                      <h3 className="font-bold text-sm text-deep-teal">
                        Thông báo
                      </h3>
                    </div>
                    {notifications.length > 0 && (
                      <span className="relative z-10 bg-coral text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
                        {notifications.length} mới
                      </span>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/30">
                    {notifications.length === 0 ? (
                      <div className="px-6 py-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-slate-50 to-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-4 shadow-inner">
                          <BellOff size={28} />
                        </div>
                        <p className="text-base font-black text-deep-teal mb-1.5">
                          Bạn đã cập nhật hết!
                        </p>
                        <p className="text-sm text-slate-500 font-medium">
                          Hiện tại không có thông báo nào cần xử lý.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {notifications.map((n, i) => (
                          <div
                            key={i}
                            className="group relative p-4 rounded-[20px] hover:bg-white transition-all duration-300 flex items-start gap-4 cursor-default border border-transparent hover:border-slate-100 hover:shadow-sm"
                          >
                            <div
                              className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 mt-0.5",
                                n.type === "birthday"
                                  ? "bg-gradient-to-br from-rose-100 to-pink-50 text-rose-500"
                                  : "bg-gradient-to-br from-indigo-100 to-sky-50 text-indigo-500",
                              )}
                            >
                              {n.type === "birthday" ? (
                                <Cake size={22} />
                              ) : (
                                <Heart size={22} />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <span
                                className={cn(
                                  "inline-flex mb-1.5 px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest uppercase",
                                  n.type === "birthday"
                                    ? "bg-rose-50 text-rose-500"
                                    : "bg-indigo-50 text-indigo-500",
                                )}
                              >
                                {n.type === "birthday"
                                  ? "Sinh nhật"
                                  : "Kỷ niệm"}
                              </span>
                              <p className="text-sm font-black text-deep-teal leading-tight mb-1.5 truncate group-hover:text-coral transition-colors">
                                {n.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-md group-hover:border-coral/20 transition-colors">
                                  <Calendar size={12} className="text-coral" />
                                  <span className="text-[10px] font-bold text-slate-600">
                                    {n.date}
                                  </span>
                                </div>
                                <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-md group-hover:border-deep-teal/20 transition-colors">
                                  <Phone
                                    size={10}
                                    className="text-deep-teal/40"
                                  />
                                  <span className="text-[11px] font-bold text-deep-teal/70 font-mono tracking-tight">
                                    {n.phone}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-10">
                              <a
                                href={`tel:${n.phone}`}
                                title="Gọi ngay"
                                className="w-10 h-10 rounded-full bg-gradient-to-br from-coral to-rose-500 text-white shadow-md flex items-center justify-center hover:shadow-lg transition-all hover:scale-110"
                              >
                                <Phone size={14} fill="currentColor" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="p-3 bg-white border-t border-slate-100">
                      <button className="w-full py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-deep-teal uppercase tracking-widest transition-colors shadow-sm">
                        Đánh dấu đã xem
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-2xl text-deep-teal/60 hover:bg-deep-teal/5 transition-all relative group"
              >
                <div className="absolute inset-0 bg-deep-teal/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                <Settings
                  size={22}
                  className="relative z-10 group-hover:rotate-45 transition-transform duration-500"
                />
              </button>
              {showSettings && (
                <div className="absolute right-0 mt-3 w-64 bg-white/90 backdrop-blur-2xl rounded-[24px] shadow-2xl border border-white/40 overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-3">
                    {!user ? (
                      <button
                        onClick={() => {
                          onOpenAuth();
                          setShowSettings(false);
                        }}
                        className="w-full px-5 py-4 rounded-xl text-left text-xs text-deep-teal font-black uppercase tracking-wider hover:bg-deep-teal/5 flex items-center gap-4 transition-all"
                      >
                        <LogIn size={20} className="text-coral" /> Đăng nhập hệ
                        thống
                      </button>
                    ) : (
                      <>
                        <div className="px-5 py-4 mb-2 flex items-center gap-3 border-b border-deep-teal/5">
                          <div className="w-10 h-10 bg-deep-teal/10 rounded-full flex items-center justify-center text-deep-teal">
                            <UserIcon size={20} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-deep-teal truncate w-32">
                              {profile?.displayName || "Thành viên"}
                            </span>
                            <span className="text-[9px] text-deep-teal/50 font-bold uppercase tracking-widest">
                              {isAdmin ? "Quản trị viên" : "Nhà phân phối"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab("profile");
                            setShowSettings(false);
                          }}
                          className="w-full px-5 py-3.5 rounded-xl text-left text-xs text-deep-teal font-black uppercase tracking-wider hover:bg-deep-teal/5 flex items-center gap-4 transition-all"
                        >
                          <UserIcon size={18} className="text-deep-teal/40" />{" "}
                          Hồ sơ cá nhân
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("store-settings");
                            setShowSettings(false);
                          }}
                          className="w-full px-5 py-3.5 rounded-xl text-left text-xs text-deep-teal font-black uppercase tracking-wider hover:bg-deep-teal/5 flex items-center gap-4 transition-all"
                        >
                          <Settings size={18} className="text-deep-teal/40" />{" "}
                          Cài đặt Cửa hàng
                        </button>
                        <button
                          onClick={() => signOut(auth)}
                          className="w-full px-5 py-3.5 rounded-xl text-left text-xs text-red-500 font-black uppercase tracking-wider hover:bg-red-50 flex items-center gap-4 transition-all"
                        >
                          <LogOut size={18} /> Đăng xuất
                        </button>
                      </>
                    )}
                    <div className="mt-2 pt-2 border-t border-deep-teal/5">
                      <button
                        onClick={handleBackup}
                        className="w-full px-5 py-3.5 rounded-xl text-left text-xs text-deep-teal font-black uppercase tracking-wider hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-4 transition-all"
                      >
                        <Download size={18} className="text-emerald-500" /> Xuất
                        dữ liệu (JSON)
                      </button>
                      <label className="w-full px-5 py-3.5 rounded-xl text-left text-xs text-deep-teal font-black uppercase tracking-wider hover:bg-orange-50 hover:text-orange-700 flex items-center gap-4 transition-all cursor-pointer">
                        <Upload size={18} className="text-orange-500" /> Nhập dữ
                        liệu (JSON)
                        <input
                          type="file"
                          className="hidden"
                          accept=".json"
                          onChange={handleRestore}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-6 left-0 w-full z-50 px-4 pointer-events-none">
        <div className="absolute bottom-[-1.5rem] w-full h-32 bg-gradient-to-t from-slate-50/90 via-slate-50/50 to-transparent pointer-events-none -z-10" />
        <div className="mx-auto flex justify-center pointer-events-auto w-full max-w-[400px]">
          <nav className="relative flex items-center justify-between w-full gap-1 bg-slate-100/80 backdrop-blur-2xl rounded-[32px] p-1.5 shadow-[0_10px_40px_-5px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.8)]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center h-[52px] transition-all duration-500 ease-out outline-none rounded-[24px]",
                    "[-webkit-tap-highlight-color:transparent]",
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveTabNav"
                      className="absolute inset-0 bg-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] border border-white rounded-[24px] z-0"
                      transition={{
                        type: "spring",
                        bounce: 0.25,
                        duration: 0.5,
                      }}
                    />
                  )}
                  <div className="relative z-10 flex items-center justify-center gap-2 overflow-hidden">
                    <tab.icon
                      size={20}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={cn(
                        "transition-all duration-500 shrink-0",
                        isActive
                          ? "text-coral scale-110 drop-shadow-sm"
                          : "text-slate-400/80 scale-100",
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <AnimatePresence>
        {restoreFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRestoreFile(null)}
              className="absolute inset-0 bg-deep-teal/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-sky-100 text-center"
            >
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-500">
                <Upload size={32} />
              </div>
              <h3 className="text-xl font-black text-deep-teal mb-3">
                Xác nhận khôi phục?
              </h3>
              <p className="text-sm text-deep-teal/60 font-medium mb-8 leading-relaxed">
                <span className="text-red-500 font-bold block mb-2 uppercase tracking-wider">
                  Cảnh báo:
                </span>
                Toàn bộ dữ liệu hiện tại sẽ bị ghi đè bởi file sao lưu. Hành
                động này không thể hoàn tác.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setRestoreFile(null)}
                  className="flex-1 py-4 bg-sky-50 text-deep-teal font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-sky-100 transition-all border border-sky-100"
                >
                  Huỷ bỏ
                </button>
                <button
                  onClick={confirmRestore}
                  className="flex-1 py-4 bg-orange-500 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-orange-200"
                >
                  Tiếp tục
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
