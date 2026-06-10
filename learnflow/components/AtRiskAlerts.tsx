'use client';

import React, { useState } from 'react';
import { 
  Clock, 
  TrendingDown, 
  RefreshCcw, 
  MessageSquare, 
  CheckCircle2,
  AlertTriangle,
  User
} from 'lucide-react';

export type AlertType = 'inactiv' | 'scor_scazut' | 'concept_repetat';
export type AlertSeverity = 'low' | 'medium' | 'high'; // Galben | Portocaliu | Roșu

export interface AtRiskAlert {
  id: string;
  studentName: string;
  studentAvatar?: string;
  type: AlertType;
  severity: AlertSeverity;
  reason: string;
  createdAt: string;
}

const MOCK_ALERTS: AtRiskAlert[] = [
  {
    id: 'a1',
    studentName: 'Andrei Vasile',
    type: 'scor_scazut',
    severity: 'high',
    reason: 'A obținut 45% la ultimul test, cu mult sub media lui obișnuită.',
    createdAt: 'Acum 2 ore'
  },
  {
    id: 'a2',
    studentName: 'Ioana Maria',
    type: 'concept_repetat',
    severity: 'medium',
    reason: 'A greșit de 4 ori la rând întrebări din "Geometrie Spațială".',
    createdAt: 'Acum 5 ore'
  },
  {
    id: 'a3',
    studentName: 'Cristian Matei',
    type: 'inactiv',
    severity: 'low',
    reason: 'Nu a mai intrat pe platformă de peste 5 zile.',
    createdAt: 'Ieri'
  }
];

interface AtRiskAlertsProps {
  alerts?: AtRiskAlert[];
  onContactStudent?: (studentName: string) => void;
  onMarkResolved?: (alertId: string) => void;
}

export default function AtRiskAlerts({ 
  alerts = MOCK_ALERTS, 
  onContactStudent, 
  onMarkResolved 
}: AtRiskAlertsProps) {
  // Păstrăm un state local pentru alertele curente, ca să putem simula dispariția lor la click pe "Rezolvat"
  const [activeAlerts, setActiveAlerts] = useState<AtRiskAlert[]>(alerts);

  const handleResolve = (id: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== id));
    if (onMarkResolved) {
      onMarkResolved(id);
    }
  };

  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case 'low': // Galben
        return 'border-amber-500/30 bg-amber-500/[0.05] shadow-[0_0_15px_rgba(245,158,11,0.05)]';
      case 'medium': // Portocaliu
        return 'border-orange-500/30 bg-orange-500/[0.05] shadow-[0_0_15px_rgba(249,115,22,0.05)]';
      case 'high': // Roșu
        return 'border-red-500/40 bg-red-500/[0.05] shadow-[0_0_15px_rgba(239,68,68,0.1)]';
      default:
        return 'border-slate-500/30 bg-slate-500/[0.05]';
    }
  };

  const getTypeIcon = (type: AlertType) => {
    switch (type) {
      case 'inactiv':
        return <Clock className="w-4 h-4" />;
      case 'scor_scazut':
        return <TrendingDown className="w-4 h-4" />;
      case 'concept_repetat':
        return <RefreshCcw className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: AlertType, severity: AlertSeverity) => {
    if (severity === 'high') return 'text-red-400';
    if (severity === 'medium') return 'text-orange-400';
    return 'text-amber-400'; // low
  };

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-2xl p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-200 mb-2">Toate alertele au fost rezolvate!</h3>
        <p className="text-slate-400">Niciun elev nu se află la risc în acest moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <h2 className="text-xl font-semibold text-white">Atenție Necesară ({activeAlerts.length})</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeAlerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`rounded-2xl p-5 border backdrop-blur-md transition-all duration-300 hover:translate-y-[-2px] flex flex-col h-full ${getSeverityStyles(alert.severity)}`}
          >
            {/* Header: Avatar + Info */}
            <div className="flex items-center gap-3 mb-4">
              {alert.studentAvatar ? (
                <img src={alert.studentAvatar} alt={alert.studentName} className="w-10 h-10 rounded-full border border-white/10 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                  <User className="w-5 h-5 text-slate-300" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-100 truncate">{alert.studentName}</h3>
                <span className="text-xs text-slate-400">{alert.createdAt}</span>
              </div>
            </div>

            {/* Alert Reason */}
            <div className="bg-black/20 rounded-xl p-3 mb-5 border border-white/5 flex-grow">
              <div className={`flex items-center gap-2 mb-2 text-sm font-medium ${getTypeColor(alert.type, alert.severity)}`}>
                {getTypeIcon(alert.type)}
                <span className="capitalize">{alert.type.replace('_', ' ')}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {alert.reason}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-auto">
              <button 
                onClick={() => onContactStudent ? onContactStudent(alert.studentName) : console.log(`Contacting ${alert.studentName}`)}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm font-medium text-slate-200 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Contactează elevul
              </button>
              
              <button 
                onClick={() => handleResolve(alert.id)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors text-sm font-medium text-emerald-400 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Marchează ca rezolvat
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
