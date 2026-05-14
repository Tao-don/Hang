import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, isAdmin: false });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const isAdminEmail = ['sunsenct89@gmail.com', 'sunrain892@gmail.com'].includes(user.email?.toLowerCase() || '');
        
        if (userDoc.exists()) {
          const currentProfile = { uid: user.uid, ...userDoc.data() } as UserProfile;
          // Sync admin status if email is in whitelist but role is not admin
          if (isAdminEmail && currentProfile.role !== 'admin') {
            const updatedProfile = { ...currentProfile, role: 'admin' as const };
            await setDoc(doc(db, 'users', user.uid), updatedProfile);
            setProfile(updatedProfile);
          } else {
            setProfile(currentProfile);
          }
        } else {
          // New user
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            role: isAdminEmail ? 'admin' : 'employee'
          };
          await setDoc(doc(db, 'users', user.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const isAdmin = profile?.role === 'admin' || ['sunsenct89@gmail.com', 'sunrain892@gmail.com'].includes(user?.email?.toLowerCase() || '');

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
