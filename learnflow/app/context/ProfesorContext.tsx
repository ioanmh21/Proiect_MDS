'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface ProfesorContextType {
  userName: string;
  initial: string;
  isLoading: boolean;
  handleSignOut: () => Promise<void>;
}

const ProfesorContext = createContext<ProfesorContextType | undefined>(undefined);

export function ProfesorProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Profesor");
  const [initial, setInitial] = useState("P");
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
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
          
          if (profile) {
            const fullName = `Prof. ${profile.last_name || profile.first_name || ''}`;
            setUserName(fullName.trim());
            setInitial((profile.last_name?.[0] || profile.first_name?.[0] || "P").toUpperCase());
          }
        }
      } catch (error) {
        console.error("Error fetching profesor profile:", error);
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
    initial,
    isLoading,
    handleSignOut,
  };

  return (
    <ProfesorContext.Provider value={value}>
      {children}
    </ProfesorContext.Provider>
  );
}

export function useProfesor() {
  const context = useContext(ProfesorContext);
  if (context === undefined) {
    throw new Error('useProfesor must be used within a ProfesorProvider');
  }
  return context;
}
