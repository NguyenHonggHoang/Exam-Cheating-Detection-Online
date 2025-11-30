
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiClient } from '../api/client';
import axios from 'axios';

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
  setUserFromProfile?: (profile: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getUserRoleFromRoles = (roles?: string[] | null): UserRole => {
  const r = roles ?? [];
  console.log('[AuthContext] Checking roles:', r);
  if (r.includes('ROLE_ADMIN') || r.includes('ADMIN')) return 'ADMIN';
  if (r.includes('ROLE_REVIEWER') || r.includes('REVIEWER')) return 'PROCTOR';
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
        const response = await axios.get('/api/auth/userinfo');
        const profile = response.data;

        if (profile && isMounted) {
          const roles = extractRolesFromProfile(profile);
          console.log('[AuthContext] Profile received:', { sub: profile.sub, roles, authorities: profile.authorities });
          const userData: User = {
            id: profile.sub,
            username: profile.username || profile.preferred_username || profile.email,
            email: profile.email,
            fullName: profile.fullName || profile.name,
            role: getUserRoleFromRoles(roles),
            roles,
          };
          console.log('[AuthContext] User role determined:', userData.role);
          setUser(userData);
        }
      } catch (error) {
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

  const setUserFromProfile = (profile: any) => {
    if (!profile) return;
    try {
      const roles = extractRolesFromProfile(profile);
      console.log('[AuthContext] setUserFromProfile:', { sub: profile.sub, roles, authorities: profile.authorities });
      const userData: User = {
        id: profile.sub,
        username: profile.username || profile.preferred_username || profile.email,
        email: profile.email,
        fullName: profile.fullName || profile.name,
        role: getUserRoleFromRoles(roles),
        roles,
      };
      console.log('[AuthContext] User role determined:', userData.role);
      setUser(userData);
    } catch (err) {
      console.error('Failed to set user from profile:', err);
    }
  };

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
      window.location.href = '/login';
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
        setUserFromProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng trong AuthProvider');
  }
  return context;
};
