import { useState, useEffect, useCallback, useRef } from 'react';

// Tipuri pentru datele ce vin din API
export interface StudentAnalyticsData {
  averageScore: number;
  studyTime: string;
  testsCompleted: number;
  weeklyScores: Array<{ week: string; score: number }>;
  conceptLevels: Array<{ concept: string; level: number }>;
  weakConcepts: Array<{ id: string; name: string; errorRate: number }>;
  aiRecommendation?: {
    title: string;
    description: string;
    estimatedTime: string;
    difficulty: string;
  };
}

interface CacheItem {
  data: StudentAnalyticsData;
  timestamp: number;
}

interface UseStudentAnalyticsReturn {
  data: StudentAnalyticsData | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
  isRefetching: boolean; // Util pentru a arăta un mic indicator vizual (fără a demonta componenta) că datele se actualizează în background
}

const CACHE_KEY_PREFIX = 'analytics_cache_';
const STALE_TIME = 5 * 60 * 1000; // 5 minute

export function useStudentAnalytics(userId: string | undefined): UseStudentAnalyticsReturn {
  const [data, setData] = useState<StudentAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Ref pentru a ține evidența timeout-ului de refresh automat
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAnalytics = useCallback(async (ignoreCache = false) => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    let shouldUseNetwork = true;
    let hasStaleData = false;
    
    // Verificăm cache-ul (SessionStorage)
    if (!ignoreCache && typeof window !== 'undefined') {
      const cachedString = sessionStorage.getItem(cacheKey);
      if (cachedString) {
        try {
          const cached: CacheItem = JSON.parse(cachedString);
          const age = Date.now() - cached.timestamp;
          
          if (age < STALE_TIME) {
            // Datele sunt proaspete, le folosim direct
            setData(cached.data);
            setIsLoading(false);
            setError(null);
            shouldUseNetwork = false;
            
            // Programăm următoarea reîmprospătare atunci când datele devin "stale"
            scheduleRefresh(STALE_TIME - age);
          } else {
            // Stale-While-Revalidate: Arătăm datele învechite imediat, dar facem fetch în fundal
            setData(cached.data);
            setIsLoading(false);
            hasStaleData = true;
            setIsRefetching(true); // Indicator subtil că datele se schimbă
          }
        } catch (e) {
          // Eroare la parsarea JSON din sessionStorage, trecem mai departe și ignorăm cache-ul
          console.warn("Invalid cache format for analytics data.");
        }
      }
    }

    if (shouldUseNetwork) {
      if (!hasStaleData) {
        setTimeout(() => setIsLoading(true), 0);
      }
      
      try {
        const response = await fetch(`/api/analytics/student/${userId}`);
        
        if (!response.ok) {
          throw new Error(`Eroare la obținerea datelor: ${response.status} ${response.statusText}`);
        }
        
        const newData: StudentAnalyticsData = await response.json();
        
        setData(newData);
        setError(null);
        
        // Salvăm în cache doar dacă suntem în browser
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: newData,
            timestamp: Date.now()
          }));
        }

        // Programăm reîmprospătarea peste 5 minute
        scheduleRefresh(STALE_TIME);

      } catch (err) {
        // Dacă am primit eroare dar aveam date stale, nu suprascriem data cu null, doar arătăm eroarea
        setError(err instanceof Error ? err : new Error('A apărut o eroare necunoscută.'));
      } finally {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, [userId]);

  // Helper pentru a asigura curățarea timeout-urilor la unmount sau re-programare
  const scheduleRefresh = useCallback(function scheduleRefreshFn(delayMs: number) {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      fetchAnalytics(true); // Fortăm re-fetch-ul în background ignorând timestamp-ul
    }, delayMs);
  }, [fetchAnalytics]);

  // Efect principal care rulează la montare / schimbarea userId
  useEffect(() => {
    fetchAnalytics();
    
    // Cleanup la unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchAnalytics]);

  // Funcție de retry la cererea utilizatorului (ex: la apăsarea pe "Încearcă din nou")
  const retry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    fetchAnalytics(true); // bypass cache on manual retry
  }, [fetchAnalytics]);

  return { data, isLoading, isRefetching, error, retry };
}
