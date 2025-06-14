'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Amplify } from 'aws-amplify';
import { 
  fetchAuthSession, 
  signIn as awsSignIn, 
  signOut as awsSignOut, 
  signUp as awsSignUp, 
  confirmSignUp as awsConfirmSignUp, 
  resetPassword as awsResetPassword, 
  confirmResetPassword as awsConfirmResetPassword, 
  getCurrentUser,
  updatePassword as awsUpdatePassword
} from 'aws-amplify/auth';
import { useRouter, usePathname } from 'next/navigation';

// Configure Amplify with environment variables
const config = {
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
      region: process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-west-2',
    }
  }
};

// Only configure Amplify in the browser
if (typeof window !== 'undefined') {
  Amplify.configure(config);
}

interface User {
  username: string;
  email: string;
  attributes: {
    email: string;
    email_verified: boolean;
    sub: string;
    picture?: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (username: string, password: string, email: string) => Promise<{ success: boolean; error?: string }>;
  confirmSignUp: (username: string, code: string) => Promise<{ success: boolean; error?: string }>;
  resendConfirmationCode: (username: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  forgotPassword: (username: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (username: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  forgotPasswordSubmit: (username: string, code: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const checkUser = useCallback(async () => {
    try {
      const { tokens } = await fetchAuthSession();
      if (tokens?.idToken) {
        const currentUser = await getCurrentUser();
        setUser({
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId || '',
          attributes: {
            email: currentUser.signInDetails?.loginId || '',
            email_verified: true,
            sub: currentUser.userId || '',
          },
        });
        setIsAuthenticated(true);
      } else {
        throw new Error('No active session');
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/submit-plan'];
    const isProtectedRoute = protectedRoutes.some(route => 
      pathname?.startsWith(route)
    );

    if (!loading && !isAuthenticated && isProtectedRoute) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || '/')}`);
    }
  }, [isAuthenticated, loading, pathname, router]);

  const signIn = async (username: string, password: string) => {
    try {
      await awsSignIn({ username, password });
      await checkUser();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to sign in' };
    }
  };

  const signUp = async (username: string, password: string, email: string) => {
    try {
      await awsSignUp({
        username,
        password,
        options: {
          userAttributes: {
            email,
          },
          autoSignIn: true
        }
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to sign up' };
    }
  };

  const confirmSignUp = async (username: string, code: string) => {
    try {
      await awsConfirmSignUp({ username, confirmationCode: code });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to confirm sign up' };
    }
  };

  const resendConfirmationCode = async (username: string) => {
    try {
      await awsSignUp({
        username,
        password: Math.random().toString(36).slice(2) + 'A1!', // Dummy password for resend
        options: {
          userAttributes: {},
          autoSignIn: false
        }
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to resend confirmation code' };
    }
  };

  const handleSignOut = async () => {
    try {
      await awsSignOut();
      setUser(null);
      setIsAuthenticated(false);
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      throw error; // Re-throw to allow error handling in the UI if needed
    }
  };

  const handleForgotPassword = async (username: string) => {
    try {
      await awsResetPassword({ username });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to initiate password reset' };
    }
  };

  const handleResetPassword = async (username: string, code: string, newPassword: string) => {
    try {
      await awsConfirmResetPassword({
        username,
        confirmationCode: code,
        newPassword
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reset password' };
    }
  };

  const handleChangePassword = async (oldPassword: string, newPassword: string) => {
    if (!user?.username) {
      return { success: false, error: 'No user is currently signed in' };
    }
    
    try {
      // First sign in the user with their current password
      await awsSignIn({ 
        username: user.username, 
        password: oldPassword 
      });
      
      // Update the password
      await awsUpdatePassword({
        oldPassword,
        newPassword
      });
      
      return { success: true };
      
    } catch (error: any) {
      console.error('Error changing password:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to change password. Please try again.' 
      };
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    signIn,
    signUp,
    confirmSignUp,
    resendConfirmationCode,
    signOut: handleSignOut,
    forgotPassword: handleForgotPassword,
    resetPassword: handleResetPassword,
    changePassword: handleChangePassword,
    forgotPasswordSubmit: handleResetPassword // Alias for resetPassword for backward compatibility
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
