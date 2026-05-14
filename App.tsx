import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { OrdersView } from './components/OrdersView';
import { AnalyticsView } from './components/AnalyticsView';
import { CustomersView } from './components/CustomersView';
import { CVView } from './components/CVView';
import { InventoryView } from './components/InventoryView';
import { ProfileView } from './components/ProfileView';
import { StoreSettingsView } from './components/StoreSettingsView';
import { Loader2 } from 'lucide-react';

const ThemeBackground = React.memo(({ theme }: { theme: string }) => {
  return (
    <>
      {theme === 'default' && (
        <>
          <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-light-teal/20 rounded-full blur-[100px] pointer-events-none transition-all duration-1000"></div>
          <div className="absolute bottom-[-100px] left-[-100px] w-[300px] h-[300px] bg-coral/10 rounded-full blur-[80px] pointer-events-none transition-all duration-1000"></div>
        </>
      )}

      {theme === 'lotus' && (
        <>
          <div className="fixed inset-0 bg-gradient-to-br from-[#fcf5f7] via-[#f9e9ec] to-[#f4d1db] pointer-events-none transition-all duration-1000 -z-20"></div>
          
          <div className="fixed top-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-gradient-to-bl from-[#d77692]/30 to-[#941b3c]/5 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed bottom-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-gradient-to-tr from-[#2a8a5b]/15 to-[#cbe3d0]/10 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed top-[30%] left-[20%] w-[40vw] h-[40vw] bg-[#941b3c]/5 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 -z-10"></div>
          
          {/* Detailed Modern Lotus Flower SVG backgrounds */}
          <svg className="fixed top-[-5vh] right-[-5vw] w-[45vw] min-w-[300px] opacity-[0.04] pointer-events-none rotate-12 transition-all duration-1000 -z-10" viewBox="0 0 100 100" fill="currentColor" style={{color: '#941b3c'}}>
             <path d="M 50 10 C 70 40, 80 70, 50 90 C 20 70, 30 40, 50 10 Z" />
             <path d="M 50 90 C 65 85, 90 60, 80 25 C 70 50, 55 65, 50 90 Z" opacity="0.8" />
             <path d="M 50 90 C 35 85, 10 60, 20 25 C 30 50, 45 65, 50 90 Z" opacity="0.8" />
             <path d="M 50 90 C 75 95, 100 70, 95 45 C 80 65, 60 85, 50 90 Z" opacity="0.6" />
             <path d="M 50 90 C 25 95, 0 70, 5 45 C 20 65, 40 85, 50 90 Z" opacity="0.6" />
          </svg>
          
          <svg className="fixed bottom-[5vh] left-[-5vw] w-[50vw] min-w-[350px] opacity-[0.03] pointer-events-none -rotate-[15deg] transition-all duration-1000 -z-10" viewBox="0 0 100 100" fill="currentColor" style={{color: '#2a8a5b'}}>
             <path d="M 50 10 C 70 40, 80 70, 50 90 C 20 70, 30 40, 50 10 Z" />
             <path d="M 50 90 C 65 85, 90 60, 80 25 C 70 50, 55 65, 50 90 Z" opacity="0.8" />
             <path d="M 50 90 C 35 85, 10 60, 20 25 C 30 50, 45 65, 50 90 Z" opacity="0.8" />
             <path d="M 50 90 C 75 95, 100 70, 95 45 C 80 65, 60 85, 50 90 Z" opacity="0.6" />
             <path d="M 50 90 C 25 95, 0 70, 5 45 C 20 65, 40 85, 50 90 Z" opacity="0.6" />
          </svg>

          {/* Water waves at bottom */}
          <svg className="fixed bottom-0 left-0 w-full h-[30vh] opacity-[0.05] pointer-events-none transition-all duration-1000 -z-10" viewBox="0 0 1440 320" preserveAspectRatio="none" fill="currentColor" style={{color: '#2a8a5b'}}>
             <path d="M0,160L48,170.7C96,181,192,203,288,197.3C384,192,480,160,576,149.3C672,139,768,149,864,176C960,203,1056,245,1152,245.3C1248,245,1344,203,1392,181.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </>
      )}

      {theme === 'april30' && (
        <>
          <div className="fixed inset-0 bg-gradient-to-br from-[#fffaf0] via-[#ffe3cc] to-[#fcd9cd] pointer-events-none transition-all duration-1000 -z-20"></div>
          
          <div className="fixed top-[-150px] right-[-100px] w-[60vw] h-[60vw] bg-gradient-to-bl from-[#da251d]/20 to-[#da251d]/5 rounded-full blur-[140px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed bottom-[-100px] left-[-150px] w-[50vw] h-[50vw] bg-gradient-to-tr from-[#ffcd00]/25 to-[#ffcd00]/5 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed top-[40%] right-[10%] w-[30vh] h-[30vh] bg-[#da251d]/15 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 -z-10"></div>
          
          {/* Vietnam Flag Backgrounds */}
          <svg className="fixed top-[10vh] right-[2vw] w-[35vw] min-w-[240px] opacity-[0.09] pointer-events-none transition-all duration-1000 -z-10 rotate-[5deg]" viewBox="0 0 300 200" fill="none">
             <rect x="0" y="0" width="300" height="200" fill="#da251d" />
             <g transform="translate(150, 100)">
                 <polygon fill="#ffcd00" points="0,-60 13.5,-18.5 57,-18.5 21.8,7.1 35.3,48.5 0,22.9 -35.3,48.5 -21.8,7.1 -57,-18.5 -13.5,-18.5" />
             </g>
          </svg>
          
          <svg className="fixed bottom-[5vh] left-[2vw] w-[45vw] min-w-[320px] opacity-[0.11] pointer-events-none -rotate-[8deg] transition-all duration-1000 -z-10" viewBox="0 0 300 200" fill="none">
             <rect x="0" y="0" width="300" height="200" fill="#da251d" />
             <g transform="translate(150, 100)">
                 <polygon fill="#ffcd00" points="0,-60 13.5,-18.5 57,-18.5 21.8,7.1 35.3,48.5 0,22.9 -35.3,48.5 -21.8,7.1 -57,-18.5 -13.5,-18.5" />
             </g>
          </svg>
        </>
      )}

      {theme === 'classic' && (
        <>
          <div className="fixed inset-0 bg-[#f8fafc] pointer-events-none transition-all duration-1000 -z-20"></div>
          <div className="fixed top-[-100px] right-[-100px] w-[50vw] h-[50vw] bg-gradient-to-bl from-[#172554]/10 to-[#0891b2]/10 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed bottom-[-150px] left-[-150px] w-[60vw] h-[60vw] bg-gradient-to-tr from-[#ea580c]/10 to-[#fed7aa]/10 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed top-[40%] left-[20%] w-[40vh] h-[40vh] bg-[#0891b2]/5 rounded-full blur-[80px] pointer-events-none transition-all duration-1000 -z-10"></div>
        </>
      )}

      {theme === 'pastel' && (
        <>
          <div className="fixed inset-0 bg-gradient-to-br from-[#fcfdfe] to-[#f8f9fc] pointer-events-none transition-all duration-1000 -z-20"></div>
          <div className="fixed top-[-100px] right-[-100px] w-[60vw] h-[60vw] bg-gradient-to-bl from-[#b8c0e0]/30 to-[#7885b5]/10 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed bottom-[-150px] left-[-150px] w-[70vw] h-[70vw] bg-gradient-to-tr from-[#f3b0c3]/20 to-[#fde8ec]/30 rounded-full blur-[140px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed top-[30%] right-[30%] w-[40vh] h-[40vh] bg-[#fde8ec]/40 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 -z-10"></div>
        </>
      )}

      {theme === 'serenity' && (
        <>
          <div className="fixed inset-0 bg-gradient-to-br from-[#fbfdfa] to-[#f4f7f2] pointer-events-none transition-all duration-1000 -z-20"></div>
          <div className="fixed top-[-100px] right-[-100px] w-[60vw] h-[60vw] bg-gradient-to-bl from-[#A1BE95]/20 to-[#92AAC7]/20 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed bottom-[-150px] left-[-150px] w-[70vw] h-[70vw] bg-gradient-to-tr from-[#ED5752]/10 to-[#E2DFA2]/20 rounded-full blur-[140px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed top-[20%] left-[30%] w-[35vh] h-[35vh] bg-[#A1BE95]/10 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 -z-10"></div>
        </>
      )}

      {theme === 'retro' && (
        <>
          <div className="fixed inset-0 bg-[#f6f5f3] pointer-events-none transition-all duration-1000 -z-20"></div>
          <div className="fixed top-[-150px] right-[-100px] w-[70vw] h-[70vw] bg-gradient-to-bl from-[#4a3b32]/10 to-[#9ca3af]/10 rounded-full blur-[140px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed bottom-[-100px] left-[-100px] w-[60vw] h-[60vw] bg-gradient-to-tr from-[#a8846c]/15 to-[#eaddd7]/40 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed top-[40%] right-[20%] w-[40vh] h-[40vh] bg-[#a8846c]/10 rounded-full blur-[90px] pointer-events-none transition-all duration-1000 -z-10"></div>
        </>
      )}

      {theme === 'bluegreen' && (
        <>
          <div className="fixed inset-0 bg-[#f0f7f4] pointer-events-none transition-all duration-1000 -z-20"></div>
          <div className="fixed top-[-100px] right-[-100px] w-[60vw] h-[60vw] bg-gradient-to-bl from-[#021C1E]/10 to-[#004445]/5 rounded-full blur-[120px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed bottom-[-150px] left-[-150px] w-[70vw] h-[70vw] bg-gradient-to-tr from-[#2C7873]/10 to-[#6FB98F]/20 rounded-full blur-[140px] pointer-events-none transition-all duration-1000 -z-10 mix-blend-multiply"></div>
          <div className="fixed top-[40%] right-[30%] w-[40vh] h-[40vh] bg-[#6FB98F]/15 rounded-full blur-[100px] pointer-events-none transition-all duration-1000 -z-10"></div>
        </>
      )}
    </>
  );
});

const AppContent: React.FC = () => {
  const { loading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'default');

  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') || 'default';
    if (savedTheme !== 'default') {
      document.documentElement.setAttribute('data-theme', savedTheme);
      setTheme(savedTheme);
    }

    const handleThemeChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setTheme(customEvent.detail);
      }
    };

    window.addEventListener('theme-changed', handleThemeChanged);
    return () => window.removeEventListener('theme-changed', handleThemeChanged);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg-creamy">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={48} className="text-deep-teal animate-spin" />
          <p className="text-deep-teal font-black uppercase tracking-widest animate-pulse">BNDShop Pro</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Decorative Elements */}
      <ThemeBackground theme={theme} />

      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <main className="w-full mx-auto px-2 md:px-6 pt-0 md:pt-8 pb-4 flex-1 max-w-[1700px] relative z-10 animate-fade-in">
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'customers' && <CustomersView />}
        {activeTab === 'cv' && <CVView />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'profile' && <ProfileView />}
        {activeTab === 'store-settings' && <StoreSettingsView />}
        
        {/* Bottom spacer for mobile navigation */}
        <div className="md:hidden h-28" />
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      
      {/* Toast Notification */}
      <div id="toast" className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-deep-teal text-white px-8 py-4 rounded-[20px] shadow-2xl z-[1000] border border-white/10 font-bold text-xs uppercase tracking-widest transition-all duration-500 opacity-0 pointer-events-none transform scale-90">
        Message Here
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
