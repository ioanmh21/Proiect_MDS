'use client';

import React from 'react';
import { ElevProvider } from '@/app/context/ElevContext';

export default function ElevLayout({ children }: { children: React.ReactNode }) {
  return (
    <ElevProvider>
      {children}
    </ElevProvider>
  );
}
