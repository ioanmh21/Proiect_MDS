import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Încărcăm întâi variabilele din .env.test (suprascrie .env.local dacă există conflicte manuale, dar pentru siguranță folosim exact ce e în .env.test)
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY lipsesc din .env.test");
}

// Client Admin care are puteri depline asupra bazei (Service Role)
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export const TEST_USER_ID = process.env.TEST_USER_ID || '12345678-1234-1234-1234-123456789012';

beforeAll(async () => {
  // Creăm utilizatorul în auth.users folosind Admin API (dacă nu există deja)
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    id: TEST_USER_ID,
    email: 'test_integration@learnflow.com',
    password: 'password123',
    email_confirm: true,
  });

  // Ignorăm eroarea de 'user already exists'
  if (authError && !authError.message.includes('already exists') && !authError.message.includes('already been registered')) {
     console.error("🧹 [DB Setup] Error creating auth user:", authError.message);
  }

  // După creare auth.users, trigger-ul din supabase s-ar putea să fi creat profilul,
  // dar pentru siguranță forțăm upsert-ul pentru rolul corect
  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: TEST_USER_ID,
    first_name: 'Test',
    last_name: 'Teacher',
    role: 'teacher'
  });
  if (profileError) console.error("🧹 [DB Setup] Error updating test profile:", profileError.message);

  // Ștergem datele user-ului de test din materials (regula ON DELETE CASCADE va curăța și chunks + jobs)
  const { error } = await supabaseAdmin.from('materials').delete().eq('teacher_id', TEST_USER_ID);
  if (error) console.error("🧹 [DB Setup] Error cleaning up before suite:", error.message);
});

afterAll(async () => {
  // Cleanup final
  const { error } = await supabaseAdmin.from('materials').delete().eq('teacher_id', TEST_USER_ID);
  if (error) console.error("🧹 [DB Cleanup] Error cleaning up after suite:", error.message);
});
