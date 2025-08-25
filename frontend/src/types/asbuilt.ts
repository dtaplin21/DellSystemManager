// As-built Information Types
// Based on approved mapping tables and database schema

export type ID = string;
export type ISO = string;

// Domain enum matching database
export type AsbuiltDomain = 
  | 'panel_placement'
  | 'panel_seaming'
  | 'non_destructive'
  | 'trial_weld'
  | 'repairs'
  | 'destructive';

// Base record interface
export interface BaseRecord {
  id: ID;
  projectId: ID;
  panelId: ID;              // strict filter for sidebar folders
  sourceDocId?: ID;
  createdAt: ISO;
  updatedAt?: ISO;
  createdBy?: ID;
  aiConfidence?: number;    // 0.0 - 1.0
  requiresReview: boolean;
}

// Panel Placement Domain
export interface PanelPlacementRecord extends BaseRecord {
  domain: 'panel_placement';
  mappedData: {
    dateTime?: ISO | string;
    panelNumber?: string;
    locationNote?: string;
    weatherComments?: string;
  };
}

// Panel Seaming Domain
export interface PanelSeamingRecord extends BaseRecord {
  domain: 'panel_seaming';
  mappedData: {
    dateTime?: ISO | string;
    panelNumbers?: string;    // e.g., "54|62"
    seamLength?: number;
    seamerInitials?: string;
    machineNumber?: string | number;
    wedgeTemp?: number;
    nipRollerSpeed?: number | string;
    barrelTemp?: number;
    preheatTemp?: number;
    trackPeelInside?: number;
    trackPeelOutside?: number;
    tensileLbsPerIn?: number;
    tensileRate?: number | string;
    vboxPassFail?: "Pass" | "Fail" | "N/A";
    weatherComments?: string;
  };
}

// Non-Destructive Testing Domain
export interface NonDestructiveRecord extends BaseRecord {
  domain: 'non_destructive';
  mappedData: {
    dateTime?: ISO | string;
    panelNumbers?: string;
    operatorInitials?: string;
    vboxPassFail?: "Pass" | "Fail";
    notes?: string;
  };
}

// Trial Weld Domain
export interface TrialWeldRecord extends BaseRecord {
  domain: 'trial_weld';
  mappedData: {
    dateTime?: ISO | string;
    seamerInitials?: string;
    machineNumber?: string | number;
    wedgeTemp?: number;
    nipRollerSpeed?: number | string;
    barrelTemp?: number;
    preheatTemp?: number;
    trackPeelInside?: number;
    trackPeelOutside?: number;
    tensileLbsPerIn?: number;
    tensileRate?: number | string;
    passFail?: "Pass" | "Fail";
    ambientTemp?: number;
    comments?: string;
  };
}

// Repairs Domain
export interface RepairRecord extends BaseRecord {
  domain: 'repairs';
  mappedData: {
    date?: ISO | string;
    repairId?: string;        // e.g., DS-11
    panelNumbers?: string;    // "1|57"
    extruderNumber?: string | number;
    operatorInitials?: string;
    typeDetailLocation?: string;
    vboxPassFail?: "Pass" | "Fail";
  };
}

// Destructive Testing Domain
export interface DestructiveRecord extends BaseRecord {
  domain: 'destructive';
  mappedData: {
    date?: ISO | string;
    panelNumbers?: string;
    sampleId?: string;        // DS-5
    testerInitials?: string;
    machineNumber?: string | number;
    trackPeelInside?: number;
    trackPeelOutside?: number;
    tensileLbsPerIn?: number;
    tensileRate?: number | string;
    passFail?: "Pass" | "Fail";
    comments?: string;
  };
}

// Union type for all record types
export type AsbuiltRecord = 
  | PanelPlacementRecord
  | PanelSeamingRecord
  | NonDestructiveRecord
  | TrialWeldRecord
  | RepairRecord
  | DestructiveRecord;

// Right neighbor peek data
export interface RightNeighborPeek {
  panelNumber: string;
  panelId: string;
  quickStatus: string;
  link: string;
}

// Panel summary data for sidebar
export interface PanelAsbuiltSummary {
  panelPlacement: PanelPlacementRecord[];
  panelSeaming: PanelSeamingRecord[];
  nonDestructive: NonDestructiveRecord[];
  trialWeld: TrialWeldRecord[];
  repairs: RepairRecord[];
  destructive: DestructiveRecord[];
  rightNeighborPeek?: RightNeighborPeek;
}

// Import response
export interface ImportResponse {
  importedRows: number;
  unmappedHeaders: string[];
  confidenceScore: number;
  requiresReview: boolean;
  pendingRows: number;
  errors?: string[];
}

// Manual entry request
export interface ManualEntryRequest {
  projectId: string;
  panelId: string;
  domain: AsbuiltDomain;
  data: Record<string, any>;
}

// Field mapping for AI import
export interface FieldMapping {
  sourceHeader: string;
  canonicalField: string;
  confidence: number;
  domain: AsbuiltDomain;
}
