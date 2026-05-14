import React, { useState } from 'react';
import { useAuth } from '../AuthProvider';
import { db, storage } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Camera, Phone, Cake, Calendar, Loader2, LogOut, CheckCircle2, 
  ShieldCheck, UserCircle2, BarChart3, Fingerprint, 
  Settings2, ChevronRight, Sparkles, Mail, ShieldAlert, Palette
} from 'lucide-react';
import { showToast, cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { EmployeeStats } from './EmployeeStats';
import { AdminManagement } from './AdminManagement';

export const ProfileView: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'admins'>('profile');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [birthday, setBirthday] = useState(profile?.birthday || '');
  const [joinDate, setJoinDate] = useState(profile?.joinDate || '');
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'default');

  if (!profile) return null;

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('app-theme', newTheme);
    if (newTheme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: newTheme }));
    showToast('Đã thay đổi giao diện!');
  };

  const handleLogout = async () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')) {
      await signOut(auth);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName,
        phone,
        birthday,
        joinDate
      });
      showToast('Đã lưu các thay đổi hồ sơ cá nhân!');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi cập nhật hồ sơ!');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileRef = ref(storage, `avatars/${profile.uid}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'users', profile.uid), { photoURL: url });
      showToast('Đã cập nhật ảnh đại diện mới!');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tải lên ảnh.');
    } finally {
      setLoading(false);
    }
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileRef = ref(storage, `covers/${profile.uid}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'users', profile.uid), { coverURL: url });
      showToast('Đã cập nhật ảnh bìa mới!');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tải lên ảnh bìa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto animate-fade-in pb-20 mt-4 px-4 sm:px-6 lg:px-8">
      
      {/* Header Context */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-deep-teal tracking-tight flex items-center gap-3">
          Tài Khoản Của Tôi <Sparkles className="text-coral" size={24} />
        </h1>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          Quản lý thông tin định danh và cài đặt cá nhân của bạn
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 item-start">
        
        {/* Left Column - Navigation & Identity */}
        <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
            {/* ID Card */}
            <div className="bg-white rounded-[32px] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative group/card transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
               {/* Cover Image Part */}
               <div className="h-40 bg-slate-100 relative group/cover cursor-pointer overflow-hidden">
                  {profile.coverURL ? (
                    <img src={profile.coverURL} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105" alt="Cover" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-sky-100 to-emerald-50"></div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/20 transition-all duration-300 pointer-events-none"></div>
                  <label className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-all duration-300 cursor-pointer z-10">
                     <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl text-deep-teal font-bold text-xs flex items-center gap-2 tracking-wide shadow-xl transform translate-y-4 group-hover/cover:translate-y-0 transition-transform duration-300">
                        <Camera size={14} /> Thay đổi ảnh bìa
                     </div>
                     <input type="file" className="hidden" accept="image/*" onChange={handleCoverChange} />
                  </label>
               </div>

               {/* Avatar & Info */}
               <div className="relative px-6 pb-8">
                  <div className="flex justify-between items-end -mt-12 mb-4 relative z-20">
                      <div className="relative group/avatar cursor-pointer">
                         <div className="w-24 h-24 rounded-[28px] p-1.5 bg-white shadow-xl rotate-3 group-hover/avatar:rotate-0 transition-all duration-300">
                            <img 
                              src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}&background=034c5f&color=fff&size=200`} 
                              className="w-full h-full rounded-[20px] object-cover" 
                              alt="Avatar" 
                            />
                         </div>
                         <label className="absolute inset-1.5 rounded-[20px] bg-deep-teal/60 backdrop-blur-sm flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 cursor-pointer">
                             <Camera size={20} className="mb-0.5" />
                             <span className="text-[9px] font-black uppercase tracking-widest">Đổi Logo</span>
                             <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                         </label>
                      </div>
                      <div className="pb-1">
                        <div className="inline-flex px-3 py-1 bg-slate-50 rounded-xl border border-slate-200">
                           {profile.role === 'admin' ? <ShieldCheck size={14} className="text-coral mr-1.5" /> : <UserCircle2 size={14} className="text-sky-500 mr-1.5" />}
                           <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 mt-0.5">
                             {profile.role === 'admin' ? 'Quản Trị' : 'Nhà Phân Phối'}
                           </span>
                        </div>
                      </div>
                  </div>

                  <h2 className="text-xl font-black text-deep-teal tracking-tight mb-1">{profile.displayName || 'Chưa cập nhật tên'}</h2>
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                    <Mail size={12} /> {profile.email}
                  </p>
               </div>
            </div>

            {/* Menu */}
            <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-3 flex flex-col gap-1.5">
               <button 
                 onClick={() => setActiveTab('profile')} 
                 className={cn("flex items-center justify-between px-5 py-4 rounded-[20px] font-bold transition-all text-sm group", activeTab === 'profile' ? "bg-slate-50 text-deep-teal shadow-inner border border-slate-100/60" : "text-slate-500 hover:bg-slate-50/50 hover:text-deep-teal")}
               >
                  <div className="flex items-center gap-3">
                    <Fingerprint size={18} className={activeTab === 'profile' ? "text-coral" : "text-slate-400 group-hover:text-coral transition-colors"} /> 
                    <span className="tracking-wide">Hồ Sơ Của Tôi</span>
                  </div>
                  {activeTab === 'profile' && <ChevronRight size={16} className="text-slate-400" />}
               </button>
               {isAdmin && (
                 <>
                   <button 
                     onClick={() => setActiveTab('stats')} 
                     className={cn("flex items-center justify-between px-5 py-4 rounded-[20px] font-bold transition-all text-sm group", activeTab === 'stats' ? "bg-slate-50 text-deep-teal shadow-inner border border-slate-100/60" : "text-slate-500 hover:bg-slate-50/50 hover:text-deep-teal")}
                   >
                      <div className="flex items-center gap-3">
                        <BarChart3 size={18} className={activeTab === 'stats' ? "text-emerald-500" : "text-slate-400 group-hover:text-emerald-500 transition-colors"} /> 
                        <span className="tracking-wide">Hiệu Suất Tổng Cục</span>
                      </div>
                      {activeTab === 'stats' && <ChevronRight size={16} className="text-slate-400" />}
                   </button>
                   <button 
                     onClick={() => setActiveTab('admins')} 
                     className={cn("flex items-center justify-between px-5 py-4 rounded-[20px] font-bold transition-all text-sm group", activeTab === 'admins' ? "bg-slate-50 text-deep-teal shadow-inner border border-slate-100/60" : "text-slate-500 hover:bg-slate-50/50 hover:text-deep-teal")}
                   >
                      <div className="flex items-center gap-3">
                        <ShieldAlert size={18} className={activeTab === 'admins' ? "text-purple-500" : "text-slate-400 group-hover:text-purple-500 transition-colors"} /> 
                        <span className="tracking-wide">Thiết Lập Quản Trị</span>
                      </div>
                      {activeTab === 'admins' && <ChevronRight size={16} className="text-slate-400" />}
                   </button>
                 </>
               )}
               
               <div className="h-px bg-slate-100 my-2 mx-4"></div>
               
               <button onClick={handleLogout} className="flex items-center justify-between px-5 py-4 rounded-[20px] font-bold transition-all text-sm text-red-500 hover:bg-red-50 group">
                  <div className="flex items-center gap-3">
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" /> 
                    <span className="tracking-wide">Đăng Xuất</span>
                  </div>
               </button>
            </div>
        </div>

        {/* Right Column - Forms & Stats */}
        <div className="flex-1">
           {activeTab === 'profile' ? (
             <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* Identity Configuration */}
               <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-8 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-sky-50/50 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>

                   <div className="flex items-center gap-3 mb-8 relative z-10">
                      <div className="w-12 h-12 rounded-[20px] bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 shadow-sm">
                         <UserCircle2 size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-deep-teal">Thông Tin Cơ Bản</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">Mục này dùng để định danh bạn trên hệ thống.</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                       {/* Name */}
                       <div className="flex flex-col gap-2 p-5 bg-slate-50/50 rounded-[24px] border border-slate-100 focus-within:border-sky-200 focus-within:bg-white focus-within:shadow-sm transition-all group">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tên hiển thị</label>
                           <input 
                             type="text" 
                             className="w-full bg-transparent outline-none font-bold text-deep-teal text-[15px] placeholder:text-slate-300" 
                             value={displayName} 
                             onChange={(e) => setDisplayName(e.target.value)} 
                             placeholder="VD: Nguyễn Văn A..." 
                           />
                       </div>
                       
                       {/* Email */}
                       <div className="flex flex-col gap-2 p-5 bg-slate-100/50 rounded-[24px] border border-transparent opacity-80">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                              Tài khoản Email 
                              <ShieldCheck size={12} className="text-emerald-500" />
                           </label>
                           <input 
                             type="text" 
                             className="w-full bg-transparent outline-none font-bold text-slate-600 text-[15px] cursor-not-allowed" 
                             disabled 
                             value={profile.email} 
                           />
                       </div>
                   </div>
               </div>

               {/* Additional Details */}
               <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-8 relative overflow-hidden">
                   <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-coral/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                   <div className="flex items-center gap-3 mb-8 relative z-10">
                      <div className="w-12 h-12 rounded-[20px] bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 shadow-sm">
                         <Settings2 size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-deep-teal">Chi Tiết Liên Hệ & Cột Mốc</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">Cập nhật thông tin để kết nối dễ dàng hơn.</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                       {/* Phone */}
                       <div className="flex flex-col gap-2 p-5 md:col-span-2 bg-slate-50/50 rounded-[24px] border border-slate-100 focus-within:border-sky-200 focus-within:bg-white focus-within:shadow-sm transition-all">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Phone size={12} /> Số Điện Thoại</label>
                           <input 
                              type="text" 
                              className="w-full bg-transparent outline-none font-bold text-deep-teal text-[15px] placeholder:text-slate-300" 
                              value={phone} 
                              onChange={(e) => setPhone(e.target.value)} 
                              placeholder="09xx.xxx.xxx" 
                           />
                       </div>

                       {/* DOB */}
                       <div className="flex flex-col gap-2 p-5 bg-slate-50/50 rounded-[24px] border border-slate-100 focus-within:border-sky-200 focus-within:bg-white focus-within:shadow-sm transition-all">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Cake size={12} /> Ngày Sinh</label>
                           <input 
                              type="text" 
                              className="w-full bg-transparent outline-none font-bold text-deep-teal text-[15px] placeholder:text-slate-300" 
                              placeholder="DD/MM/YYYY" 
                              value={birthday} 
                              onChange={(e) => setBirthday(e.target.value)} 
                           />
                       </div>
                       
                       {/* Join Date */}
                       <div className="flex flex-col gap-2 p-5 bg-slate-50/50 rounded-[24px] border border-slate-100 focus-within:border-sky-200 focus-within:bg-white focus-within:shadow-sm transition-all">
                           <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Calendar size={12} /> Gia Nhập</label>
                           <input 
                              type="text" 
                              className="w-full bg-transparent outline-none font-bold text-deep-teal text-[15px] placeholder:text-slate-300" 
                              placeholder="DD/MM/YYYY" 
                              value={joinDate} 
                              onChange={(e) => setJoinDate(e.target.value)} 
                           />
                       </div>
                   </div>
               </div>

               {/* Theme Settings */}
               <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-8 relative overflow-hidden mt-6">
                   <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-50/50 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>

                   <div className="flex items-center gap-3 mb-8 relative z-10">
                      <div className="w-12 h-12 rounded-[20px] bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 shadow-sm">
                         <Palette size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-deep-teal">Giao Diện Màu Sắc</h3>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">Tùy biến phong cách cá nhân hóa hệ thống.</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4 relative z-10">
                       <button onClick={() => handleThemeChange('default')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'default' ? "border-[#034c5f] bg-[#034c5f]/5 shadow-sm" : "border-slate-100 hover:border-[#034c5f]/30 bg-white")}>
                         {theme === 'default' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#034c5f] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#034c5f] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#97bec6] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#ee6457] rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Mặc Định</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Đại Dương Xanh</p>
                         </div>
                       </button>

                       <button onClick={() => handleThemeChange('lotus')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'lotus' ? "border-[#941b3c] bg-[#941b3c]/5 shadow-sm" : "border-slate-100 hover:border-[#941b3c]/30 bg-white")}>
                         {theme === 'lotus' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#941b3c] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#941b3c] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#d77692] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#2a8a5b] rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Hoa Sen</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Tinh Khôi & Diệu Kỳ</p>
                         </div>
                       </button>

                       <button onClick={() => handleThemeChange('april30')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'april30' ? "border-[#da251d] bg-[#da251d]/5 shadow-sm" : "border-slate-100 hover:border-[#da251d]/30 bg-white")}>
                         {theme === 'april30' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#da251d] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#da251d] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#ffcd00] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#ffcd00]/50 rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Tháng Tư</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Hào Hùng</p>
                         </div>
                       </button>

                       <button onClick={() => handleThemeChange('classic')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'classic' ? "border-[#172554] bg-[#172554]/5 shadow-sm" : "border-slate-100 hover:border-[#172554]/30 bg-white")}>
                         {theme === 'classic' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#172554] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#172554] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#0891b2] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#ea580c] rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Cổ Điển</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Truyền Cảm Hứng</p>
                         </div>
                       </button>

                       <button onClick={() => handleThemeChange('pastel')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'pastel' ? "border-[#7885b5] bg-[#7885b5]/5 shadow-sm" : "border-slate-100 hover:border-[#7885b5]/30 bg-white")}>
                         {theme === 'pastel' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#7885b5] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#7885b5] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#b8c0e0] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#f3b0c3] rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Pastel</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Nhẹ Nhàng, Tinh Tế</p>
                         </div>
                       </button>

                       <button onClick={() => handleThemeChange('serenity')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'serenity' ? "border-[#92AAC7] bg-[#92AAC7]/5 shadow-sm" : "border-slate-100 hover:border-[#92AAC7]/30 bg-white")}>
                         {theme === 'serenity' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#92AAC7] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#92AAC7] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#A1BE95] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#ED5752] rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Yên Bình</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Thư Giãn, Sống Động</p>
                         </div>
                       </button>

                       <button onClick={() => handleThemeChange('retro')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'retro' ? "border-[#4a3b32] bg-[#4a3b32]/5 shadow-sm" : "border-slate-100 hover:border-[#4a3b32]/30 bg-white")}>
                         {theme === 'retro' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#4a3b32] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#4a3b32] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#9ca3af] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#a8846c] rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Retro Café</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Xưa Cũ, Gợi Cảm</p>
                         </div>
                       </button>

                       <button onClick={() => handleThemeChange('bluegreen')} className={cn("p-4 rounded-2xl flex flex-col gap-3 border-2 transition-all relative overflow-hidden text-left", theme === 'bluegreen' ? "border-[#021C1E] bg-[#021C1E]/5 shadow-sm" : "border-slate-100 hover:border-[#021C1E]/30 bg-white")}>
                         {theme === 'bluegreen' && <div className="absolute top-2 right-2 w-2 h-2 bg-[#021C1E] rounded-full"></div>}
                         <div className="flex gap-2 w-full">
                            <div className="w-8 h-8 rounded-full bg-[#021C1E] shadow-sm"></div>
                            <div className="flex flex-col gap-1 flex-1">
                              <div className="w-full h-3.5 bg-[#004445] rounded-md"></div>
                              <div className="w-2/3 h-3.5 bg-[#2C7873] rounded-md"></div>
                            </div>
                         </div>
                         <div className="mt-2">
                           <h4 className="font-bold text-[13px] text-slate-700">Blue Green</h4>
                           <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Tươi Mới, Bình Yên</p>
                         </div>
                       </button>
                   </div>
               </div>

               {/* Actions */}
               <div className="flex justify-end pt-2">
                   <button 
                     onClick={handleSave} 
                     disabled={loading} 
                     className="bg-deep-teal hover:bg-[#033b49] text-white px-8 py-4 rounded-[20px] shadow-[0_8px_20px_-4px_rgba(3,76,95,0.3)] flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 w-full sm:w-auto"
                   >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Lưu Thay Đổi</>}
                   </button>
               </div>
             </div>
           ) : activeTab === 'stats' ? (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <EmployeeStats />
             </div>
           ) : (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <AdminManagement />
             </div>
           )}
        </div>

      </div>
    </div>
  );
};


