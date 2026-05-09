import { NextResponse } from 'next/server';

interface SimulateRequest {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as SimulateRequest;

    if (!body.inputMint || !body.outputMint || !body.amount) {
      return NextResponse.json(
        { error: 'Missing required fields: inputMint, outputMint, amount' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      status: 'not_implemented',
      message: 'Simulation endpoint stub. Engine-side simulation will be wired in Phase 5 orchestrator.',
      params: {
        inputMint: body.inputMint,
        outputMint: body.outputMint,
        amount: body.amount,
        slippageBps: body.slippageBps ?? 300,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
