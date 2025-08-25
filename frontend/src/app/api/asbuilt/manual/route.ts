import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, panelId, domain, data } = body;

    // Validate required fields
    if (!projectId || !panelId || !domain || !data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For now, return success with mock data
    // TODO: Integrate with backend API
    const mockRecord = {
      id: `record-${Date.now()}`,
      projectId,
      panelId,
      domain,
      sourceDocId: null,
      rawData: data,
      mappedData: data,
      aiConfidence: 1.0, // Manual entry has 100% confidence
      requiresReview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-1'
    };

    return NextResponse.json({
      success: true,
      record: mockRecord,
      message: 'Record created successfully'
    });
  } catch (error) {
    console.error('Error creating manual record:', error);
    return NextResponse.json(
      { error: 'Failed to create record' },
      { status: 500 }
    );
  }
}
