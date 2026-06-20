'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  LogOut,
  Bell,
  Search
} from 'lucide-react';
import { ProfesorProvider, useProfesor } from '@/app/context/ProfesorContext';

function ProfesorLayoutContent({ children }: { children: React.ReactNode }) {
  const { userName, initial, handleSignOut, isLoading } = useProfesor();
  const pathname = usePathname();

  const navItems = [
    { id: '/dashboard/profesor', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { id: '/dashboard/profesor/clase', label: 'Clase & Elevi', icon: Users, exact: false },
    { id: '/dashboard/profesor/materiale', label: 'Materiale', icon: FileText, exact: false },
  ];

  const handleSettings = () => {
    alert("Setările vor fi disponibile în curând!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex selection:bg-purple-500/30">
      {/* Background Effects */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/10 bg-slate-950/50 backdrop-blur-xl hidden md:flex flex-col relative z-20">
        <div className="p-6">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
            LearnFlow
          </h2>
          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1 block">
            Portal Profesor
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = item.exact 
              ? pathname === item.id 
              : pathname.startsWith(item.id);

            return (
              <Link
                key={item.id}
                href={item.id}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button onClick={handleSettings} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all duration-200">
            <Settings className="w-5 h-5" />
            <span className="font-medium">Setări</span>
          </button>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Deconectare</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative z-10 overflow-y-auto">
        {/* Top Header */}
        <header className="h-20 border-b border-white/10 bg-slate-950/30 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-30">
          <div className="relative hidden sm:block">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Caută materiale, elevi..." 
              className="bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all w-64 text-white placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-white">{userName}</div>
                <div className="text-xs text-slate-400">Profesor</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg border border-white/20">
                {initial}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        {children}
      </main>
    </div>
  );
}

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfesorProvider>
      <ProfesorLayoutContent>
        {children}
      </ProfesorLayoutContent>
    </ProfesorProvider>
  );
}
