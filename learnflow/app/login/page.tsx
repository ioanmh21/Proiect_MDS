"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Optional: could auto-load last used, but we'll use buttons instead
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    console.log("Attempting login for:", email);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log("Login result:", { data, signInError });

    if (signInError) {
      console.error("Login Error:", signInError.message);
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === 'teacher' || profile?.role === 'profesor') {
        router.push("/dashboard/profesor");
        router.refresh();
      } else if (profile?.role === 'admin') {
        router.push("/dashboard/admin");
        router.refresh();
      } else {
        router.push("/dashboard/elev");
        router.refresh();
      }
    } else {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[linear-gradient(135deg,#09090b_0%,#1e1b4b_50%,#0f172a_100%)] text-white p-4 font-sans">
      
      {/* Background Animated Blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-500/15 blur-[100px] mix-blend-screen animate-pulse duration-10000 z-0"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-500/15 blur-[100px] mix-blend-screen animate-pulse duration-10000 z-0 delay-1000"></div>

      <div className="relative z-10 w-full max-w-md bg-white/[0.03] backdrop-blur-[16px] border border-white/10 p-8 rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/5 border border-white/10 mb-2">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            Welcome back
          </h2>
          <p className="text-sm text-slate-400">
            Please sign in to your account
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 mb-6 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Dev Quick Actions */}
          <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2 px-1 flex-wrap gap-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                localStorage.setItem("dev_teacher_email", email);
                localStorage.setItem("dev_teacher_password", password);
                alert("Date profesor salvate!");
              }} className="hover:text-indigo-400 transition-colors">Save Prof</button>
              <button type="button" onClick={() => {
                setEmail(localStorage.getItem("dev_teacher_email") || "");
                setPassword(localStorage.getItem("dev_teacher_password") || "");
              }} className="hover:text-indigo-400 transition-colors">Load Prof</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                localStorage.setItem("dev_student_email", email);
                localStorage.setItem("dev_student_password", password);
                alert("Date elev salvate!");
              }} className="hover:text-purple-400 transition-colors">Save Elev</button>
              <button type="button" onClick={() => {
                setEmail(localStorage.getItem("dev_student_email") || "");
                setPassword(localStorage.getItem("dev_student_password") || "");
              }} className="hover:text-purple-400 transition-colors">Load Elev</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                localStorage.setItem("dev_admin_email", email);
                localStorage.setItem("dev_admin_password", password);
                alert("Date admin salvate!");
              }} className="hover:text-emerald-400 transition-colors">Save Admin</button>
              <button type="button" onClick={() => {
                setEmail(localStorage.getItem("dev_admin_email") || "");
                setPassword(localStorage.getItem("dev_admin_password") || "");
              }} className="hover:text-emerald-400 transition-colors">Load Admin</button>
            </div>
          </div>
          <div className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] disabled:opacity-70 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Link to Register */}
        <p className="text-center text-sm text-slate-400 mt-8">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-indigo-400 hover:text-purple-400 transition-colors"
          >
            Sign up here
          </Link>
        </p>
      </div>
    </div>
  );
}
