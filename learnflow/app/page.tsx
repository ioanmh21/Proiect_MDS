"use client";

import { useState } from 'react';
import styles from './page.module.css';

export default function LoginPage() {
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Authentication logic would go here
    console.log(`${isLogin ? 'Login' : 'Register'} as ${role}`, { email, password });
  };

  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        <div className={styles.header}>
          <h1 className={styles.logo}>LearnFlow AI</h1>
          <p className={styles.subtitle}>
            {isLogin ? 'Welcome back to your learning journey' : 'Start your learning journey today'}
          </p>
        </div>

        <div className={styles.roleToggle}>
          <button 
            type="button"
            className={`${styles.roleButton} ${role === 'student' ? styles.active : ''}`}
            onClick={() => setRole('student')}
          >
            Student
          </button>
          <button 
            type="button"
            className={`${styles.roleButton} ${role === 'teacher' ? styles.active : ''}`}
            onClick={() => setRole('teacher')}
          >
            Teacher
          </button>
        </div>

        <form className={`${styles.form} ${styles.fadeTransition}`} onSubmit={handleSubmit} key={isLogin ? 'login' : 'register'}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>Email Address</label>
            <input 
              id="email" 
              type="email" 
              className={styles.input} 
              placeholder={`Enter your ${role} email`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div className={styles.inputGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input 
              id="password" 
              type="password" 
              className={styles.input} 
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className={styles.submitBtn}>
            {isLogin ? `Login as ${role === 'teacher' ? 'Teacher' : 'Student'}` : `Register as ${role === 'teacher' ? 'Teacher' : 'Student'}`}
          </button>
        </form>

        <div className={styles.footer}>
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <button className={styles.link} onClick={() => setIsLogin(false)}>
                Register as {role === 'teacher' ? 'Teacher' : 'Student'}
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button className={styles.link} onClick={() => setIsLogin(true)}>
                Login here
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
