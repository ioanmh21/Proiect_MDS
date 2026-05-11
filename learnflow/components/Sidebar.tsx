'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  BookOpen,
  CheckSquare,
  LogOut,
  Menu,
  X
} from 'lucide-react';

export type Role = 'elev' | 'profesor' | 'admin';

interface SidebarProps {
  role: Role;
  user: {
    name: string;
    email: string;
    avatarInitials: string;
  };
}

export default function Sidebar({ role, user }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const menuConfig = {
    elev: [
      { href: '/dashboard/elev', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/elev/cursuri', label: 'Cursurile mele', icon: BookOpen },
      { href: '/dashboard/elev/teste', label: 'Teste & Note', icon: CheckSquare },
    ],
    profesor: [
      { href: '/dashboard/profesor', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/profesor/clase', label: 'Clase & Elevi', icon: Users },
      { href: '/dashboard/profesor/materiale', label: 'Materiale', icon: FileText },
      { href: '/dashboard/profesor/rapoarte', label: 'Rapoarte', icon: BarChart3 },
    ],
    admin: [
      { href: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/admin/utilizatori', label: 'Utilizatori', icon: Users },
      { href: '/dashboard/admin/setari', label: 'Setări Platformă', icon: Settings },
    ]
  };

  const links = menuConfig[role] || menuConfig['elev'];

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-slate-900/80 backdrop-blur border border-white/10 text-slate-200 hover:bg-white/10 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay for mobile drawer */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-950/80 backdrop-blur-xl border-r border-white/10 
        flex flex-col z-50 transition-transform duration-300 ease-in-out
        md:translate-x-0 md:static md:shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* Mobile Close Button */}
        <button 
          onClick={() => setIsOpen(false)}
          className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Logo Area */}
        <div className="p-6 h-20 flex items-center border-b border-white/10">
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400">
              LearnFlow
            </h2>
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold block mt-1">
              Portal {role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {links.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)} // Close drawer on navigation on mobile
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : 'group-hover:text-slate-200 text-slate-500'}`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info Bottom Area */}
        <div className="p-4 border-t border-white/10 space-y-3 bg-slate-900/30">
          <Link href={`/dashboard/${role}/setari`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all duration-200">
            <Settings className="w-5 h-5" />
            <span className="font-medium text-sm">Setări cont</span>
          </Link>
          
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white shadow-lg border border-white/20 shrink-0">
              {user.avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
            </div>
            <button title="Deconectare" className="text-slate-500 hover:text-red-400 transition-colors p-1">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
