import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/quiz/[testId]/autosave
 * Body: { answers: Record<string, string>, timeRemaining: number, currentIndex: number }
 * Salvează progresul curent (mock — doar loghează)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const body = await request.json();

  // În producție, se salvează în DB (test_results sau o tabelă de progres)
  console.log(`[AutoSave] Test ${testId}:`, {
    answeredCount: Object.keys(body.answers || {}).length,
    timeRemaining: body.timeRemaining,
    currentIndex: body.currentIndex,
  });

  return NextResponse.json({ success: true, savedAt: new Date().toISOString() });
}
