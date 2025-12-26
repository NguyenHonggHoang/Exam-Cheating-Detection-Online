// frontends/exam-ui/src/auth/AuthContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiClient, axiosInstance } from '../api/client';

export type UserRole = 'CANDIDATE' | 'PROCTOR' | 'ADMIN' | 'REVIEWER';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  roles: string[];
  profileCompleted: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileCompleted: boolean;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  loginWithOAuth2: () => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refreshProfileStatus: () => Promise<void>;
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
  const [profileCompleted, setProfileCompleted] = useState<boolean>(true);

  // Fetch profile completion status
  const fetchProfileStatus = async (role: UserRole): Promise<boolean> => {
    // Only check for CANDIDATE role
    if (role !== 'CANDIDATE') return true;

    try {
      const res = await axiosInstance.get('/users/profile/status');
      return res.data?.profileCompleted ?? true;
    } catch (err) {
      console.warn('[AuthContext] Could not fetch profile status:', err);
      return true; // Default to completed on error
    }
  };

  const refreshProfileStatus = async () => {
    if (user?.role === 'CANDIDATE') {
      const completed = await fetchProfileStatus(user.role);
      setProfileCompleted(completed);
      setUser(prev => prev ? { ...prev, profileCompleted: completed } : null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        const session = await response.json();

        if (isMounted && session && session.user) {
          const profile = session.user;
          const roles = extractRolesFromProfile(profile);
          const role = getUserRoleFromRoles(roles);

          console.log('[AuthContext] Session found:', { id: profile.id, roles });

          // Check profile completion for candidates
          const completed = await fetchProfileStatus(role);
          setProfileCompleted(completed);

          const userData: User = {
            id: profile.id || profile.sub,
            username: profile.name || profile.username || profile.email,
            email: profile.email,
            fullName: profile.name || profile.fullName,
            role,
            roles,
            profileCompleted: completed,
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

  // Heartbeat: Keep session alive by pinging session endpoint periodically
  useEffect(() => {
    if (!user) {
      return; // No heartbeat if user is not authenticated
    }

    const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
    let heartbeatInterval: NodeJS.Timeout | null = null;

    const sendHeartbeat = async () => {
      try {
        const response = await fetch('/api/auth/session', { 
          credentials: 'include',
          method: 'GET'
        });

        if (!response.ok) {
          // Session expired or invalid
          if (response.status === 401) {
            console.log('[AuthContext] Session expired, logging out...');
            setUser(null);
            // Optionally redirect to login
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }
          return;
        }

        const session = await response.json();
        
        // Check if session has error (e.g., IdleTimeout, SessionExpired)
        if (session.error) {
          console.log('[AuthContext] Session error:', session.error);
          setUser(null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return;
        }

        // Session is still valid, update last activity
        console.log('[AuthContext] Heartbeat: Session active');
      } catch (error) {
        console.error('[AuthContext] Heartbeat error:', error);
        // Don't logout on network errors, just log
      }
    };

    // Send heartbeat immediately, then every 5 minutes
    sendHeartbeat();
    heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }, [user]);

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
        profileCompleted,
        loginWithCredentials,
        loginWithOAuth2,
        logout,
        isAuthenticated,
        refreshProfileStatus,
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