'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  QuizQuestion,
  QuizStatus,
  SubmittedAnswer,
  TestResult,
  AnswerResponse,
  FinishResponse,
} from '@/types/quiz';

// ============================================================================
// Hook: useQuizState
// Gestionează starea completă a unui test: întrebări, răspunsuri, timer, auto-save
// ============================================================================

interface UseQuizStateReturn {
  // Date
  questions: QuizQuestion[];
  currentQuestion: QuizQuestion | null;
  currentIndex: number;
  answers: Record<string, string>;
  submittedAnswers: Record<string, SubmittedAnswer>;
  testResult: TestResult | null;
  testTitle: string;

  // Timer
  timeRemaining: number;
  totalTime: number;

  // Status
  status: QuizStatus;
  isSubmitting: boolean;

  // Acțiuni
  setAnswer: (questionId: string, answer: string) => void;
  submitAnswer: (questionId: string, answer: string) => Promise<void>;
  finishTest: () => Promise<void>;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
}

const AUTO_SAVE_INTERVAL = 30_000; // 30 secunde

export function useQuizState(testId: string): UseQuizStateReturn {
  // --- State principal ---
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, SubmittedAnswer>>({});
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testTitle, setTestTitle] = useState('');

  // --- Timer ---
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  // --- Status ---
  const [status, setStatus] = useState<QuizStatus>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Refs pentru interval cleanup ---
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef(answers);
  const currentIndexRef = useRef(currentIndex);
  const timeRemainingRef = useRef(timeRemaining);

  // Keep refs in sync
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { timeRemainingRef.current = timeRemaining; }, [timeRemaining]);

  // Persist answers to localStorage so the results page can access them
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(`quiz-answers-${testId}`, JSON.stringify(answers));
    }
  }, [answers, testId]);

  // ========================================================================
  // 1. Încarcă întrebările din API la mount
  // ========================================================================
  useEffect(() => {
    let cancelled = false;

    async function loadQuestions() {
      try {
        setStatus('loading');
        const res = await fetch(`/api/quiz/${testId}`);
        if (!res.ok) throw new Error('Eroare la încărcarea testului');

        const data = await res.json();
        if (cancelled) return;

        setQuestions(data.questions);
        setTotalTime(data.totalTime);
        setTimeRemaining(data.totalTime);
        setTestTitle(data.title || 'Test');
        setStatus('in_progress');
      } catch (err) {
        console.error('Error loading quiz:', err);
        if (!cancelled) setStatus('error');
      }
    }

    loadQuestions();
    return () => { cancelled = true; };
  }, [testId]);

  // ========================================================================
  // 2. Timer countdown (1s interval)
  // ========================================================================
  useEffect(() => {
    if (status !== 'in_progress') return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timpul a expirat — finalizează automat
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Auto-finish când timpul expiră
  useEffect(() => {
    if (timeRemaining === 0 && status === 'in_progress' && questions.length > 0) {
      finishTest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, status, questions.length]);

  // ========================================================================
  // 3. Auto-save la fiecare 30 secunde
  // ========================================================================
  useEffect(() => {
    if (status !== 'in_progress') return;

    autoSaveRef.current = setInterval(async () => {
      try {
        await fetch(`/api/quiz/${testId}/autosave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers: answersRef.current,
            timeRemaining: timeRemainingRef.current,
            currentIndex: currentIndexRef.current,
          }),
        });
        console.log('[AutoSave] Progres salvat');
      } catch (err) {
        console.warn('[AutoSave] Eroare la salvare:', err);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [status, testId]);

  // ========================================================================
  // 4. Setează răspunsul (fără submit — doar tracking)
  // ========================================================================
  const setAnswer = useCallback((questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }, []);

  // ========================================================================
  // 5. Submit Answer — salvare optimistă + async API
  // ========================================================================
  const submitAnswer = useCallback(
    async (questionId: string, answer: string) => {
      // Salvare optimistă în state
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));
      setIsSubmitting(true);

      try {
        const res = await fetch(`/api/quiz/${testId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionId, answer }),
        });

        if (!res.ok) throw new Error('Eroare la verificarea răspunsului');

        const data: AnswerResponse = await res.json();

        setSubmittedAnswers((prev) => ({
          ...prev,
          [questionId]: {
            answer,
            isCorrect: data.isCorrect,
            correctAnswer: data.correctAnswer,
            explanation: data.explanation,
          },
        }));
      } catch (err) {
        console.error('Error submitting answer:', err);
        // Rollback: ștergem feedback-ul dacă a eșuat
        setSubmittedAnswers((prev) => {
          const updated = { ...prev };
          delete updated[questionId];
          return updated;
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [testId]
  );

  // ========================================================================
  // 6. Finish Test — trimite toate răspunsurile pentru notare
  // ========================================================================
  const finishTest = useCallback(async () => {
    if (status === 'submitted') return;

    setIsSubmitting(true);
    // Oprește timer-ul și auto-save-ul
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);

    try {
      const res = await fetch(`/api/quiz/${testId}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersRef.current }),
      });

      if (!res.ok) throw new Error('Eroare la finalizarea testului');

      const data: FinishResponse = await res.json();

      setSubmittedAnswers(data.submittedAnswers);
      setTestResult({
        testId,
        score: data.score,
        totalPoints: data.totalPoints,
        percentage: data.percentage,
        questions,
        answers: answersRef.current,
        submittedAnswers: data.submittedAnswers,
        completedAt: data.completedAt,
      });
      setStatus('submitted');
    } catch (err) {
      console.error('Error finishing test:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [testId, status, questions]);

  // ========================================================================
  // 7. Navigare între întrebări
  // ========================================================================
  const goToQuestion = useCallback(
    (index: number) => {
      if (index >= 0 && index < questions.length) {
        setCurrentIndex(index);
      }
    },
    [questions.length]
  );

  const nextQuestion = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1));
  }, [questions.length]);

  const prevQuestion = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // ========================================================================
  // Return
  // ========================================================================
  return {
    questions,
    currentQuestion: questions[currentIndex] || null,
    currentIndex,
    answers,
    submittedAnswers,
    testResult,
    testTitle,
    timeRemaining,
    totalTime,
    status,
    isSubmitting,
    setAnswer,
    submitAnswer,
    finishTest,
    goToQuestion,
    nextQuestion,
    prevQuestion,
  };
}
