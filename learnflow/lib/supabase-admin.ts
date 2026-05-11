/**
 * lib/supabase-admin.ts
 * =====================
 * Client Supabase cu Service Role Key — bypass complet RLS.
 *
 * ⚠️  ATENȚIE: Folosește EXCLUSIV pe server (Route Handlers, Server Actions,
 *     after() callbacks). Nu expune NICIODATĂ în cod client-side.
 *
 * Util pentru:
 *  • Taskuri background (after()) fără context de request
 *  • Operații administrative (inserare/update fără restricții de user)
 *  • Migrări programatice de date
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type AdminSupabaseClient = SupabaseClient<Database>;

let _adminClient: AdminSupabaseClient | null = null;

/**
 * Returnează un singleton al clientului admin Supabase.
 * Singleton-ul este sigur pentru reutilizare în același process Node.js.
 *
 * @throws Error dacă variabilele de mediu lipsesc
 */
export function createAdminClient(): AdminSupabaseClient {
  if (_adminClient) return _adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      '[SupabaseAdmin] NEXT_PUBLIC_SUPABASE_URL lipsește din .env.local'
    );
  }
  if (!serviceKey) {
    throw new Error(
      '[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY lipsește din .env.local. ' +
        'Obține-l din Supabase Dashboard → Settings → API → service_role key.'
    );
  }

  _adminClient = createClient<Database>(url, serviceKey, {
    auth: {
      // Dezactivăm persistența sesiunii — nu avem utilizator real
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _adminClient;
}
