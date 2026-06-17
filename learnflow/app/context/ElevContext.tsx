/* eslint-disable */
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export interface ClassData {
  id: string;
  name: string;
}

interface ElevContextType {
  userName: string;
  classes: ClassData[];
  isLoading: boolean;
  handleSignOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const ElevContext = createContext<ElevContextType | undefined>(undefined);

export function ElevProvider({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Elev");
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  const fetchProfile = useCallback(async () => {
    setTimeout(() => setIsLoading(true), 0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 1. Aducem numele din profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("id", user.id)
          .single();
        
        if (profile?.first_name) {
          setUserName(profile.first_name);
        }

        // 2. Aducem clasele la care e înscris
        const { data: classLinks } = await supabase
          .from("student_classes")
          .select("classes(id, name)")
          .eq("student_id", user.id);
        
        if (classLinks) {
          // Supabase returnează un array de { classes: {id, name} }
          const userClasses = classLinks
            .map((link: any) => link.classes)
            .filter(Boolean) as ClassData[];
          setClasses(userClasses);
        }
      }
    } catch (error) {
      console.error("Error fetching elev profile:", error);
    } finally {
      setTimeout(() => setIsLoading(false), 0);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const value = {
    userName,
    classes,
    isLoading,
    handleSignOut,
    refreshProfile: fetchProfile,
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
