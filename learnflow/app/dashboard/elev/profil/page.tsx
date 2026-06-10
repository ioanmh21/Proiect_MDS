'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useElev } from '@/app/context/ElevContext';
import StudentProgressDashboard from '@/components/StudentProgressDashboard';
import { ArrowLeft, User, Loader2 } from 'lucide-react';

export default function StudentProfilePage() {
  const { userName, isLoading: isContextLoading } = useElev();
  const router = useRouter();

  const [progressData, setProgressData] = useState({
    averageScore: 0,
    studyTime: "0m",
    testsCompleted: 0,
    testsHistory: []
  });
  const [isProgressLoading, setIsProgressLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const response = await fetch('/api/progress');
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setProgressData({
              averageScore: data.averageScore || 0,
              studyTime: data.studyTime || "0m",
              testsCompleted: data.testsCompleted || 0,
              testsHistory: data.testsHistory || []
            });
          }
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setIsProgressLoading(false);
      }
    }

    if (!isContextLoading) {
      fetchProgress();
    }
  }, [isContextLoading]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-6 md:p-8 font-sans selection:bg-purple-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard/elev')}
            className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Profil și Statistici</h1>
              <p className="text-sm text-slate-400">Analizează-ți progresul și performanța, {userName}.</p>
            </div>
          </div>
        </header>

        {/* Content */}
        {isProgressLoading || isContextLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <StudentProgressDashboard 
              progressSummary={{
                averageScore: progressData.averageScore,
                totalStudyTime: progressData.studyTime,
                materialsCount: progressData.testsCompleted
              }}
              testScores={progressData.testsHistory.length > 0 ? progressData.testsHistory : undefined}
            />
          </div>
        )}

      </div>
    </div>
  );
}
