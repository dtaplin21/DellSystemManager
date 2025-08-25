import { NextRequest, NextResponse } from 'next/server';

// Mock data for testing - replace with actual backend integration
const mockAsbuiltData = {
  panel_placement: [
    {
      id: '1',
      projectId: 'project-1',
      panelId: 'panel-1',
      domain: 'panel_placement',
      sourceDocId: 'doc-1',
      rawData: { 'Date': '2024-01-15', 'Panel': 'P-001', 'Location': 'North Section' },
      mappedData: { dateTime: '2024-01-15T08:00:00Z', panelNumber: 'P-001', locationNote: 'North Section' },
      aiConfidence: 0.95,
      requiresReview: false,
      createdAt: '2024-01-15T08:00:00Z',
      updatedAt: '2024-01-15T08:00:00Z',
      createdBy: 'user-1'
    }
  ],
  panel_seaming: [
    {
      id: '2',
      projectId: 'project-1',
      panelId: 'panel-1',
      domain: 'panel_seaming',
      sourceDocId: 'doc-2',
      rawData: { 'Date': '2024-01-15', 'Panels': 'P-001|P-002', 'Seamer': 'JS', 'Result': 'Pass' },
      mappedData: { 
        dateTime: '2024-01-15T10:00:00Z', 
        panelNumbers: 'P-001|P-002', 
        seamerInitials: 'JS',
        vboxPassFail: 'Pass'
      },
      aiConfidence: 0.92,
      requiresReview: false,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      createdBy: 'user-1'
    }
  ],
  non_destructive: [],
  trial_weld: [],
  repairs: [],
  destructive: []
};

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; panelId: string } }
) {
  try {
    const { projectId, panelId } = params;

    // For now, return mock data
    // TODO: Integrate with backend API
    const response = {
      panelPlacement: mockAsbuiltData.panel_placement.filter(r => r.panelId === panelId),
      panelSeaming: mockAsbuiltData.panel_seaming.filter(r => r.panelId === panelId),
      nonDestructive: mockAsbuiltData.non_destructive.filter(r => r.panelId === panelId),
      trialWeld: mockAsbuiltData.trial_weld.filter(r => r.panelId === panelId),
      repairs: mockAsbuiltData.repairs.filter(r => r.panelId === panelId),
      destructive: mockAsbuiltData.destructive.filter(r => r.panelId === panelId),
      rightNeighborPeek: {
        panelNumber: 'P-002',
        panelId: 'panel-2',
        quickStatus: 'Welded',
        link: `/dashboard/projects/${projectId}/panel-layout?panel=${panelId}`
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching asbuilt data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asbuilt data' },
      { status: 500 }
    );
  }
}
