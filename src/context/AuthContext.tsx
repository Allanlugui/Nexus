import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  isInitialized: boolean | null;
  checkSetupStatus: () => Promise<void>;
  login: (user: User) => void;
  logout: () => void;
  needsAuth: boolean;
  setNeedsAuth: (needs: boolean) => void;
  refreshUsers: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

  const fetchUsers = () => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error(err));
  };

  const checkSetupStatus = async (retries = 5, delay = 2000): Promise<void> => {
    try {
      const res = await fetch('/api/system/setup-status');
      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }
      const data = await res.json();
      setIsInitialized(data.isInitialized);
      if (data.isInitialized) {
        fetchUsers();
      }
    } catch(err) {
      console.warn(`Setup Check Attempt failed (${retries} retries left):`, err);
      if (retries > 0) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(checkSetupStatus(retries - 1, delay * 1.5));
          }, delay);
        });
      } else {
        console.error("Setup Check Failed completely after all retries", err);
      }
    }
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  useEffect(() => {
    const savedUserId = localStorage.getItem('erp_user_id');
    if (savedUserId && users.length > 0 && !currentUser) {
       const user = users.find(u => u.id === savedUserId);
       if (user) {
         setCurrentUser(user);
       }
    }
  }, [users, currentUser]);

  const login = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('erp_user_id', user.id);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('erp_user_id');
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, isInitialized, checkSetupStatus, login, logout, needsAuth, setNeedsAuth, refreshUsers: fetchUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
