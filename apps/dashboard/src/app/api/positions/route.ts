import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ otocoOrders: [], predictions: [] });

  try {
    const otocoOrders = db.prepare('SELECT * FROM otoco_orders ORDER BY created_at DESC').all();
    const predictions = db.prepare('SELECT * FROM prediction_positions ORDER BY created_at DESC').all();
    return NextResponse.json({ otocoOrders, predictions });
  } catch {
    return NextResponse.json({ otocoOrders: [], predictions: [] });
  }
}
