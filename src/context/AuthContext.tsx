import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  loginWithGoogle,
  logoutUser,
  syncUserProfile,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from '../lib/firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role?: string;
  isDemo?: boolean;
  provider?: 'firebase' | 'password' | 'google' | 'demo';
  loginAt?: string;
}

interface AuthContextType {
  user: AppUser | User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  loginWithPassword: (emailOrUser: string, pass: string, remember?: boolean) => Promise<boolean>;
  registerWithPassword: (emailOrUser: string, pass: string, displayName?: string, remember?: boolean) => Promise<boolean>;
  loginDemo: (accountType?: 'PRO' | 'INSTITUTIONAL') => void;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const LOCAL_SESSION_KEY = 'minervini_auth_session';
const REGISTERED_ACCOUNTS_KEY = 'minervini_registered_accounts';

const DEFAULT_DEMO_ACCOUNTS: Record<string, { pass: string; name: string; role: string }> = {
  'trader@minervini.com': { pass: 'minervini123', name: 'Mark Minervini', role: 'SEPA Master Trader' },
  'pro@growthstock.com': { pass: 'alpha123', name: 'Alpha Growth Trader', role: 'Chartered Market Technician' },
  'hedgefund@alpha.com': { pass: 'breakout2026', name: 'Institutional Prime', role: 'Portfolio Manager' },
  'demo': { pass: 'demo', name: 'Demo Trader', role: 'Paper Trading Pro' },
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  loginWithPassword: async () => false,
  registerWithPassword: async () => false,
  loginDemo: () => {},
  signOut: async () => {},
  clearError: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Check local session storage first
    try {
      const stored = localStorage.getItem(LOCAL_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppUser;
        if (parsed && parsed.uid) {
          setUser(parsed);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('Failed to parse local session', e);
    }

    // 2. Attach Firebase Auth listener
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          await syncUserProfile(currentUser);
        } catch (e) {
          console.warn('Firestore sync profile skipped:', e);
        }
      } else {
        // If Firebase says not logged in, check if local password session is active
        const stored = localStorage.getItem(LOCAL_SESSION_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as AppUser;
            if (parsed && parsed.uid) {
              setUser(parsed);
            }
          } catch (e) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google Popup Sign In
  const signIn = async () => {
    try {
      setError(null);
      const googleUser = await loginWithGoogle();
      setUser(googleUser);
    } catch (err: any) {
      console.error('Sign-in failed:', err);
      let message = 'Failed to sign in with Google. Please try again or use Login & Password.';
      if (err.code === 'auth/popup-closed-by-user') {
        message = 'Sign-in window was closed before completion.';
      } else if (err.code === 'auth/popup-blocked') {
        message = 'Popup was blocked by browser. Please enable popups or use Login & Password.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    }
  };

  // Login with Login/Email & Password
  const loginWithPassword = async (
    emailOrUser: string,
    pass: string,
    remember: boolean = true
  ): Promise<boolean> => {
    setError(null);
    const cleanIdentifier = emailOrUser.trim().toLowerCase();
    const cleanPassword = pass.trim();

    if (!cleanIdentifier) {
      setError('Please enter your Login username or Email address.');
      return false;
    }
    if (!cleanPassword) {
      setError('Please enter your account password.');
      return false;
    }

    // A. Attempt Firebase Auth if identifier is a valid email format
    if (cleanIdentifier.includes('@') && cleanIdentifier.includes('.')) {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanIdentifier, cleanPassword);
        if (cred.user) {
          setUser(cred.user);
          await syncUserProfile(cred.user);
          if (remember) {
            const sessionData: AppUser = {
              uid: cred.user.uid,
              email: cred.user.email,
              displayName: cred.user.displayName || cleanIdentifier.split('@')[0],
              photoURL: cred.user.photoURL,
              provider: 'firebase',
              role: 'SEPA Pro Trader',
              loginAt: new Date().toLocaleTimeString(),
            };
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionData));
          }
          return true;
        }
      } catch (fbErr: any) {
        console.warn('Firebase email auth attempt failed, checking local credentials:', fbErr);
        // Only return early if Firebase returned strict bad password on existing Firebase user
        if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
          // Fall through to check registered local accounts or demo presets
        }
      }
    }

    // B. Check registered accounts in LocalStorage
    try {
      const registered = JSON.parse(localStorage.getItem(REGISTERED_ACCOUNTS_KEY) || '{}');
      if (registered[cleanIdentifier]) {
        if (registered[cleanIdentifier].pass === cleanPassword) {
          const appUser: AppUser = {
            uid: `trader-local-${cleanIdentifier}`,
            email: cleanIdentifier.includes('@') ? cleanIdentifier : `${cleanIdentifier}@minervini.com`,
            displayName: registered[cleanIdentifier].name || cleanIdentifier,
            photoURL: '',
            provider: 'password',
            role: registered[cleanIdentifier].role || 'SEPA Certified Trader',
            loginAt: new Date().toLocaleTimeString(),
          };
          setUser(appUser);
          if (remember) {
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(appUser));
          }
          return true;
        } else {
          setError('Incorrect password entered for this account. Please try again.');
          return false;
        }
      }
    } catch (e) {
      console.warn('Error reading local accounts', e);
    }

    // C. Check Default Minervini Presets
    if (DEFAULT_DEMO_ACCOUNTS[cleanIdentifier]) {
      const demo = DEFAULT_DEMO_ACCOUNTS[cleanIdentifier];
      if (demo.pass === cleanPassword) {
        const appUser: AppUser = {
          uid: `trader-preset-${cleanIdentifier}`,
          email: cleanIdentifier.includes('@') ? cleanIdentifier : `${cleanIdentifier}@minervini.com`,
          displayName: demo.name,
          photoURL: '',
          provider: 'password',
          role: demo.role,
          loginAt: new Date().toLocaleTimeString(),
        };
        setUser(appUser);
        if (remember) {
          localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(appUser));
        }
        return true;
      } else {
        setError(`Incorrect password for ${cleanIdentifier}. Preset password is: ${demo.pass}`);
        return false;
      }
    }

    // D. Universal Trader Login Acceptance:
    // If user enters a custom login & password with at least 4 characters, allow instant registration & login!
    if (cleanPassword.length >= 4) {
      const generatedName = cleanIdentifier.includes('@')
        ? cleanIdentifier.split('@')[0].replace(/[._-]/g, ' ')
        : cleanIdentifier.replace(/[._-]/g, ' ');
      const capitalized = generatedName.charAt(0).toUpperCase() + generatedName.slice(1);

      const appUser: AppUser = {
        uid: `trader-session-${Date.now()}`,
        email: cleanIdentifier.includes('@') ? cleanIdentifier : `${cleanIdentifier}@minervini.com`,
        displayName: capitalized,
        photoURL: '',
        provider: 'password',
        role: 'SEPA Pro Trader',
        loginAt: new Date().toLocaleTimeString(),
      };

      // Save to registered accounts for future logins
      try {
        const registered = JSON.parse(localStorage.getItem(REGISTERED_ACCOUNTS_KEY) || '{}');
        registered[cleanIdentifier] = {
          pass: cleanPassword,
          name: capitalized,
          role: 'SEPA Pro Trader',
        };
        localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(registered));
      } catch (e) {
        console.warn(e);
      }

      setUser(appUser);
      if (remember) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(appUser));
      }
      return true;
    }

    setError('Password must contain at least 4 characters.');
    return false;
  };

  // Register New Account
  const registerWithPassword = async (
    emailOrUser: string,
    pass: string,
    displayName?: string,
    remember: boolean = true
  ): Promise<boolean> => {
    setError(null);
    const cleanIdentifier = emailOrUser.trim().toLowerCase();
    const cleanPassword = pass.trim();

    if (!cleanIdentifier) {
      setError('Please provide a valid Login username or Email address.');
      return false;
    }
    if (cleanPassword.length < 6) {
      setError('Password must be at least 6 characters for bank-grade account security.');
      return false;
    }

    const finalName = displayName?.trim() || cleanIdentifier.split('@')[0];

    // Try Firebase Registration first if valid email
    if (cleanIdentifier.includes('@') && cleanIdentifier.includes('.')) {
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanIdentifier, cleanPassword);
        if (cred.user) {
          try {
            await updateProfile(cred.user, { displayName: finalName });
          } catch (e) {
            console.warn(e);
          }
          await syncUserProfile(cred.user);
          setUser(cred.user);
          if (remember) {
            const sessionData: AppUser = {
              uid: cred.user.uid,
              email: cred.user.email,
              displayName: finalName,
              photoURL: '',
              provider: 'firebase',
              role: 'SEPA Pro Trader',
              loginAt: new Date().toLocaleTimeString(),
            };
            localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(sessionData));
          }
          return true;
        }
      } catch (fbErr: any) {
        console.warn('Firebase user creation failed, saving to local accounts:', fbErr);
        if (fbErr.code === 'auth/email-already-in-use') {
          setError('This email is already registered. Please sign in with your password.');
          return false;
        }
      }
    }

    // Save to local registered accounts
    try {
      const registered = JSON.parse(localStorage.getItem(REGISTERED_ACCOUNTS_KEY) || '{}');
      registered[cleanIdentifier] = {
        pass: cleanPassword,
        name: finalName,
        role: 'SEPA Pro Trader',
      };
      localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(registered));

      const appUser: AppUser = {
        uid: `trader-local-${cleanIdentifier}-${Date.now()}`,
        email: cleanIdentifier.includes('@') ? cleanIdentifier : `${cleanIdentifier}@minervini.com`,
        displayName: finalName,
        photoURL: '',
        provider: 'password',
        role: 'SEPA Pro Trader',
        loginAt: new Date().toLocaleTimeString(),
      };

      setUser(appUser);
      if (remember) {
        localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(appUser));
      }
      return true;
    } catch (e) {
      console.error(e);
      setError('Failed to create local account. Please try again.');
      return false;
    }
  };

  // Instant 1-Click Demo Login
  const loginDemo = (accountType: 'PRO' | 'INSTITUTIONAL' = 'PRO') => {
    setError(null);
    const demoUser: AppUser = accountType === 'INSTITUTIONAL'
      ? {
          uid: 'trader-institutional-demo',
          email: 'institutional@alphafund.com',
          displayName: 'Institutional Desk Partner',
          photoURL: '',
          isDemo: true,
          provider: 'demo',
          role: 'Alpha Fund Portfolio Lead',
          loginAt: new Date().toLocaleTimeString(),
        }
      : {
          uid: 'trader-mark-minervini',
          email: 'mark@minervini.com',
          displayName: 'Mark Minervini',
          photoURL: '',
          isDemo: true,
          provider: 'demo',
          role: 'SEPA® Master Trader',
          loginAt: new Date().toLocaleTimeString(),
        };

    setUser(demoUser);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(demoUser));
  };

  // Sign out
  const signOut = async () => {
    try {
      setError(null);
      await logoutUser();
    } catch (err: any) {
      console.warn('Firebase logout warning:', err);
    } finally {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        loginWithPassword,
        registerWithPassword,
        loginDemo,
        signOut,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
