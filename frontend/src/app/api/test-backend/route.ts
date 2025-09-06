import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8003';
    const response = await fetch(`${backendUrl}/api/system/health`);
    
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Backend connection successful',
      backendData: data
    });
  } catch (error) {
    console.error('Backend test failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Backend connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
