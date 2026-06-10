'use client';

import React from 'react';

/**
 * Layout simplu pentru quiz — fără sidebar, full-screen focus mode
 */
export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020617]">
      {children}
    </div>
  );
}
