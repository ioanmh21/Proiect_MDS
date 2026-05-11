'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface ElevContextType {
  userName: string;
  isLoading: boolean;
  handleSignOut: () => Promise<void>;
}

const ElevContext = createContext<ElevContextType | undefined>(undefined);

export function ElevProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Elev");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", user.id)
            .single();
          
          if (profile?.first_name) {
            setUserName(profile.first_name);
          }
        }
      } catch (error) {
        console.error("Error fetching elev profile:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchProfile();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const value = {
    userName,
    isLoading,
    handleSignOut,
  };

  return (
    <ElevContext.Provider value={value}>
      {children}
    </ElevContext.Provider>
  );
}

export function useElev() {
  const context = useContext(ElevContext);
  if (context === undefined) {
    throw new Error('useElev must be used within an ElevProvider');
  }
  return context;
}
