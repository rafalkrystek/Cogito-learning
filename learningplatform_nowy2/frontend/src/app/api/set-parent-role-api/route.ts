import { NextRequest, NextResponse } from 'next/server';

// Funkcja do określenia URL backendu (taka sama jak w bug-reports)
function getBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (process.env.VERCEL || process.env.VERCEL_ENV === 'production') {
    return 'https://cogito-7zrt.onrender.com';
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://cogito-7zrt.onrender.com';
  }
  return 'http://localhost:8000';
}

const BACKEND_URL = getBackendUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    
    const response = await fetch(`${BACKEND_URL}/api/set-parent-role-api/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in set-parent-role-api:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

