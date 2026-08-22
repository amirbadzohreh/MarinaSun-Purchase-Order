import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import type { Employee } from '@/types';
import { getAuthToken, setAuthToken } from '@/services/api';
import { jwtDecode } from 'jwt-decode';

interface AuthPayload {
  employee_id: number;
  personnel_number: string;
  full_name: string;
  position: string;
  exp: number;
}

interface AuthContextType {
  user: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, employee: Employee) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const payload = jwtDecode<AuthPayload>(token);
      const currentTime = Date.now() / 1000;
      
      if (payload.exp < currentTime) {
        setAuthToken(null);
        setIsLoading(false);
        return;
      }

      const employee: Employee = {
        id: payload.employee_id,
        personnel_number: payload.personnel_number,
        full_name: payload.full_name,
        position: payload.position,
        department: '',
        email: '',
        is_active: true,
        created_at: '',
      };
      
      setUser(employee);
    } catch {
      setAuthToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (token: string, employee: Employee) => {
    setAuthToken(token);
    setUser(employee);
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      checkAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}