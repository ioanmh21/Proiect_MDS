'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  ChevronUp, 
  ChevronDown,
  AlertCircle
} from 'lucide-react';

export interface StudentReport {
  id: string;
  name: string;
  averageScore: number;
  studyTimeMinutes: number; // for sorting
  studyTimeFormatted: string; // for display
  testsCompleted: number;
  lastLogin: string;
  trend: 'up' | 'down' | 'neutral';
  isAtRisk: boolean;
}

// Date de test (Mock)
const MOCK_STUDENTS: StudentReport[] = [
  { id: '1', name: 'Alexandru Popescu', averageScore: 85, studyTimeMinutes: 150, studyTimeFormatted: '2h 30m', testsCompleted: 12, lastLogin: 'Acum 2 ore', trend: 'up', isAtRisk: false },
  { id: '2', name: 'Maria Ionescu', averageScore: 92, studyTimeMinutes: 320, studyTimeFormatted: '5h 20m', testsCompleted: 24, lastLogin: 'Acum 10 min', trend: 'up', isAtRisk: false },
  { id: '3', name: 'Mihai Radu', averageScore: 45, studyTimeMinutes: 45, studyTimeFormatted: '45m', testsCompleted: 2, lastLogin: 'Acum 3 zile', trend: 'down', isAtRisk: true },
  { id: '4', name: 'Andreea Stan', averageScore: 78, studyTimeMinutes: 120, studyTimeFormatted: '2h 00m', testsCompleted: 8, lastLogin: 'Ieri', trend: 'neutral', isAtRisk: false },
  { id: '5', name: 'Cristian Matei', averageScore: 35, studyTimeMinutes: 15, studyTimeFormatted: '15m', testsCompleted: 1, lastLogin: 'Acum 5 zile', trend: 'down', isAtRisk: true },
  { id: '6', name: 'Elena Voicu', averageScore: 88, studyTimeMinutes: 210, studyTimeFormatted: '3h 30m', testsCompleted: 15, lastLogin: 'Acum 1 zi', trend: 'up', isAtRisk: false },
];

type SortKey = keyof StudentReport;
type SortDirection = 'asc' | 'desc';

interface ClassReportTableProps {
  data?: StudentReport[];
  onKickStudent?: (studentId: string, studentName: string) => void;
}

export default function ClassReportTable({ data = MOCK_STUDENTS, onKickStudent }: ClassReportTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyAtRisk, setShowOnlyAtRisk] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'name', direction: 'asc' });

  // Funcție de sortare la click pe header
  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filtrare și Sortare derivată
  const filteredAndSortedData = useMemo(() => {
    // 1. Filtrare
    let filtered = data.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk = showOnlyAtRisk ? student.isAtRisk : true;
      return matchesSearch && matchesRisk;
    });

    // 2. Sortare
    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [data, searchQuery, showOnlyAtRisk, sortConfig]);

  // Helper pentru a randat iconița de sortare în tabel
  const renderSortIcon = (key: SortKey) => {
    if (sortConfig?.key === key) {
      return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1 inline text-purple-400" /> : <ChevronDown className="w-4 h-4 ml-1 inline text-purple-400" />;
    }
    return <ChevronDown className="w-4 h-4 ml-1 inline text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
  };

  // Helper randare icon trend
  const renderTrend = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return <ArrowUpRight className="w-5 h-5 text-emerald-400" />;
    if (trend === 'down') return <ArrowDownRight className="w-5 h-5 text-red-400" />;
    return <Minus className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
      
      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-white/10 rounded-xl bg-black/20 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all sm:text-sm"
            placeholder="Caută elev după nume..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Risk Filter */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative flex items-center justify-center">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={showOnlyAtRisk}
              onChange={(e) => setShowOnlyAtRisk(e.target.checked)}
            />
            <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500/80"></div>
          </div>
          <span className="text-sm text-slate-300 group-hover:text-white transition-colors flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition-colors" />
            Arată doar elevii la risc
          </span>
        </label>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-black/40">
            <tr>
              <th 
                scope="col" 
                className="group px-6 py-4 text-left font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('name')}
              >
                Nume {renderSortIcon('name')}
              </th>
              <th 
                scope="col" 
                className="group px-6 py-4 text-center font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('averageScore')}
              >
                Scor Mediu {renderSortIcon('averageScore')}
              </th>
              <th 
                scope="col" 
                className="group px-6 py-4 text-center font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('studyTimeMinutes')}
              >
                Timp Studiu {renderSortIcon('studyTimeMinutes')}
              </th>
              <th 
                scope="col" 
                className="group px-6 py-4 text-center font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('testsCompleted')}
              >
                Teste Completate {renderSortIcon('testsCompleted')}
              </th>
              <th 
                scope="col" 
                className="group px-6 py-4 text-left font-medium text-slate-300 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('lastLogin')}
              >
                Ultimul Login {renderSortIcon('lastLogin')}
              </th>
              <th 
                scope="col" 
                className="px-6 py-4 text-center font-medium text-slate-300 uppercase tracking-wider"
              >
                Trend
              </th>
              <th scope="col" className="px-6 py-4 relative">
                <span className="sr-only">Acțiuni</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-transparent">
            {filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((student) => (
                <tr 
                  key={student.id} 
                  className={`transition-colors ${
                    student.isAtRisk 
                      ? 'bg-red-500/[0.08] hover:bg-red-500/[0.12] border-l-2 border-l-red-500' 
                      : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-white/10 text-xs font-bold text-slate-300">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-medium text-slate-200">{student.name}</div>
                        {student.isAtRisk && (
                          <div className="text-[10px] text-red-400 flex items-center gap-1 mt-0.5 font-medium">
                            <AlertCircle className="w-3 h-3" /> Necesită intervenție
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      student.averageScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      student.averageScore >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {student.averageScore}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-slate-300">
                    {student.studyTimeFormatted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-slate-300">
                    {student.testsCompleted}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-xs">
                    {student.lastLogin}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center flex justify-center">
                    {renderTrend(student.trend)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {onKickStudent && (
                      <button
                        onClick={() => onKickStudent(student.id, student.name)}
                        className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                        title="Elimină elevul din clasă"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-minus"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Search className="w-8 h-8 text-slate-600 mb-3" />
                    <p>Nu s-au găsit elevi conform filtrelor selectate.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
