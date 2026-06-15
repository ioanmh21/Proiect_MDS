'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function DeleteUserButton({ userId, userName }: { userId: string, userName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Sigur vrei să ștergi utilizatorul ${userName}? Această acțiune este ireversibilă.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Eroare: ${data.error}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      alert('Eroare la ștergerea utilizatorului.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
      title="Șterge utilizator"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
