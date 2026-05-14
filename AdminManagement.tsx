import React, { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Shield, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import { showToast } from '../lib/utils';
import { useAuth } from '../AuthProvider';

export const AdminManagement: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth(); // current logged in admin

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('displayName')));
      const employees: UserProfile[] = usersSnap.docs.map(d => d.data() as UserProfile);
      setUsers(employees);
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (user: UserProfile) => {
    // Prevent un-admining the master admins
    if (['sunrain892@gmail.com', 'sunsenct89@gmail.com'].includes(user.email)) {
      showToast('Không thể thay đổi quyền của Admin gốc');
      return;
    }
    // Prevent changing your own role
    if (user.uid === profile?.uid) {
      showToast('Không thể tự thay đổi quyền của chính bạn');
      return;
    }

    const newRole = user.role === 'admin' ? 'employee' : 'admin';
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      showToast(`Đã đổi quyền thành ${newRole} cho ${user.email}`);
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error(error);
      showToast('Lỗi khi thay đổi quyền');
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center text-purple-500"><Loader2 size={32} className="animate-spin" /></div>;
  }

  return (
    <div className="bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 sm:p-10 relative overflow-hidden flex flex-col gap-6">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-50/50 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative z-10 mb-2">
        <div>
          <h3 className="text-xl font-black text-deep-teal tracking-tight flex items-center gap-3 mb-1">
            Thiết Lập Phân Quyền <ShieldAlert size={20} className="text-purple-500" />
          </h3>
          <p className="text-xs font-semibold text-slate-500">
            Quản lý cấp quyền truy cập hệ thống cho nhà phân phối.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 relative z-10">
        {users.map((u) => (
          <div key={u.uid} className="bg-white border border-slate-100 rounded-[28px] p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-purple-100 transition-all duration-300 flex flex-col gap-6 group shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex bg-slate-50 border border-slate-100 shadow-sm items-center justify-center w-14 h-14 rounded-[20px] overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
                 {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName || ''} className="w-full h-full object-cover" />
                 ) : (
                    <span className="font-black text-xl text-deep-teal/40">{u.email.charAt(0).toUpperCase()}</span>
                 )}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${u.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-slate-50 text-slate-500 border-slate-200 shadow-sm'}`}>
                {u.role === 'admin' ? 'Quản trị viên' : 'Nhà phân phối'}
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h4 className="font-black text-deep-teal text-lg group-hover:text-purple-600 transition-colors tracking-tight">{u.displayName || 'Chưa cập nhật tên'}</h4>
                {(u.joinDate || u.birthday) && (
                  <div className="flex items-center gap-1.5 mt-1">
                     {u.joinDate && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200">TG: {u.joinDate.split('-').reverse().join('/')}</span>}
                     {u.birthday && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-lg border border-rose-100">SN: {u.birthday.split('-').reverse().join('/')}</span>}
                  </div>
                )}
              </div>
              <p className="text-[13px] font-medium text-slate-500">{u.email}</p>
            </div>
            
            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Phân quyền</span>
              <button
                onClick={() => toggleRole(u)}
                className={`h-10 px-5 rounded-[16px] flex items-center justify-center gap-2 transition-all font-black text-[11px] uppercase tracking-widest ${
                  u.role === 'admin' 
                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white shadow-sm'
                }`}
              >
                {u.role === 'admin' ? (
                  <>
                    <Shield size={16} /> Bỏ Admin
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> Lên Admin
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

