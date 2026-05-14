import React, { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { X, Mail, Lock, LogIn, UserPlus, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else if (mode === 'register') {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, 'users', user.uid), {
          email,
          displayName: name,
          role: (email === 'sunsenct89@gmail.com') ? 'admin' : 'employee',
          joinDate: new Date().toISOString().split('T')[0]
        });
      } else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        alert('Link khôi phục mật khẩu đã được gửi đến email!');
        setMode('login');
      }
      if (mode !== 'reset') onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-deep-teal/20 z-[100] flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-white/90 rounded-[40px] p-10 w-full max-w-sm shadow-[0_32px_64px_-16px_rgba(4,47,46,0.2)] relative border border-white focus-within:border-coral/30 transition-colors"
      >
        <button onClick={onClose} className="absolute top-8 right-8 w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-400 hover:text-red-500 hover:bg-red-50 transition-all active:scale-90">
          <X size={20} />
        </button>

        <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-deep-teal to-light-teal rounded-2xl flex items-center justify-center text-white shadow-xl shadow-deep-teal/20 mb-6 rotate-3">
               <LogIn size={28} />
            </div>
            <h3 className="text-2xl font-black text-deep-teal uppercase tracking-widest text-center">
              {mode === 'login' && 'Hệ quản trị'}
              {mode === 'register' && 'Đăng ký viên'}
              {mode === 'reset' && 'Khôi phục'}
            </h3>
            <p className="text-[10px] font-black text-deep-teal/30 uppercase tracking-[0.2em] mt-2">
               Phòng thí nghiệm S&S Laboratory
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && (
             <div className="relative">
              <UserPlus size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-teal" />
              <input
                type="text"
                placeholder="Họ và tên..."
                className="theme-input !pl-12 h-14"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-teal" />
            <input
              type="email"
              placeholder="Email của bạn..."
              className="theme-input !pl-12 h-14"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== 'reset' && (
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-light-teal" />
              <input
                type="password"
                placeholder="Mật khẩu bảo mật..."
                className="theme-input !pl-12 h-14"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-fade-in">
              <Info size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest px-1">
            <button 
              type="button" 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="text-light-teal hover:text-deep-teal transition-colors"
            >
              {mode === 'login' ? 'Tạo mới' : 'Đã có?'}
            </button>
            {mode === 'login' && (
              <button 
                type="button" 
                onClick={() => setMode('reset')}
                className="text-coral/60 hover:text-coral transition-colors"
              >
                Quên mã?
              </button>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-deep-teal text-white rounded-2xl font-black uppercase text-sm shadow-xl shadow-deep-teal/20 active:scale-95 disabled:opacity-50 transition-all tracking-[0.2em]"
          >
            {loading ? 'Processing...' : (
              mode === 'login' ? 'Đăng nhập' : (mode === 'register' ? 'Ghi danh' : 'Gửi link')
            )}
          </button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-sky-100"></div>
            <span className="flex-shrink-0 mx-4 text-sky-300 text-[10px] uppercase font-black tracking-widest">Tiếp cận nhanh</span>
            <div className="flex-grow border-t border-sky-100"></div>
          </div>

          <button 
            type="button" 
            onClick={handleGoogle}
            className="w-full py-4 bg-white text-sky-700 border-2 border-sky-100 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-sky-50 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-95"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            Social Auth
          </button>
        </form>
      </motion.div>
    </div>
  );
};
