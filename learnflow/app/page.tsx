"use client";

import Link from 'next/link';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h1 className={styles.logo}>LearnFlow AI</h1>
          <p className={styles.subtitle}>
            Your intelligent learning companion. Master any topic, any time.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <Link href="/register" className="block w-full">
            <button type="button" className={`${styles.submitBtn} w-full`}>
              Get Started for Free
            </button>
          </Link>
          
          <Link href="/login" className="block w-full">
            <button 
              type="button" 
              className="w-full bg-transparent border border-white/20 text-white py-3.5 rounded-xl font-semibold hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Sign In to Your Account
            </button>
          </Link>
        </div>

        <div className={styles.footer}>
          <p>
            Are you a teacher?{' '}
            <Link href="/register" className={styles.link}>
              Join as an educator
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
