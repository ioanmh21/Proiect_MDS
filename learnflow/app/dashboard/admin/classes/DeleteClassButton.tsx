'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function DeleteClassButton({ classId, classNameStr }: { classId: string, classNameStr: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Sigur vrei să ștergi clasa "${classNameStr}"? Materialele și legăturile cu elevii se vor pierde.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/classes?id=${classId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(`Eroare: ${data.error}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      alert('Eroare la ștergerea clasei.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isDeleting}
      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
      title="Șterge clasă"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
