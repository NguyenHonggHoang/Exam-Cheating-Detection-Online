// frontends/exam-ui/src/auth/AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiClient } from '../api/client';

export type UserRole = 'CANDIDATE' | 'PROCTOR' | 'ADMIN' | 'REVIEWER';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  roles: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  loginWithOAuth2: () => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getUserRoleFromRoles = (roles?: string[] | null): UserRole => {
  const r = roles ?? [];
  if (r.includes('ROLE_ADMIN') || r.includes('ADMIN')) return 'ADMIN';
  if (r.includes('ROLE_REVIEWER') || r.includes('REVIEWER')) return 'REVIEWER';
  if (r.includes('ROLE_PROCTOR') || r.includes('PROCTOR')) return 'PROCTOR';
  if (r.includes('ROLE_CANDIDATE') || r.includes('CANDIDATE')) return 'CANDIDATE';
  return 'CANDIDATE';
};

const extractRolesFromProfile = (profile: any): string[] => {
  const roles = profile.roles || profile.authorities || [];
  return Array.isArray(roles) ? roles : [];
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        const session = await response.json();

        if (isMounted && session && session.user) {
          const profile = session.user;
          const roles = extractRolesFromProfile(profile);

          console.log('[AuthContext] Session found:', { id: profile.id, roles });

          const userData: User = {
            id: profile.id || profile.sub, 
            username: profile.name || profile.username || profile.email,
            email: profile.email,
            fullName: profile.name || profile.fullName,
            role: getUserRoleFromRoles(roles),
            roles,
          };

          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('[AuthContext] Failed to fetch session:', error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginWithCredentials = async (_username: string, _password: string) => {
    loginWithOAuth2();
  };

  const loginWithOAuth2 = () => {
    apiClient.login();
  };

  const logout = async () => {
    try {
      setUser(null);
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/api/auth/signout';
    }
  };

  const isAuthenticated = user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithCredentials,
        loginWithOAuth2,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};