export type AsbuiltDomain = 
  | 'panel_placement'
  | 'panel_seaming'
  | 'non_destructive'
  | 'trial_weld'
  | 'repairs'
  | 'destructive';

export interface AsbuiltRecord {
  id: string;
  projectId: string;
  panelId: string;
  domain: AsbuiltDomain;
  sourceDocId?: string;
  rawData: Record<string, any>;
  mappedData: Record<string, any>;
  aiConfidence: number;
  requiresReview: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AsbuiltSummary {
  totalRecords: number;
  domainCounts: Record<AsbuiltDomain, number>;
  averageConfidence: number;
  reviewRequired: number;
  lastUpdated: string;
}

export interface PanelAsbuiltSummary {
  panelId: string;
  panelNumber: string;
  totalRecords: number;
  domains: AsbuiltDomain[];
  lastUpdated: string;
  confidence: number;
}

export interface AsbuiltImportResult {
  success: boolean;
  records: AsbuiltRecord[];
  importedRows: number;
  detectedPanels: string[];
  detectedDomains: AsbuiltDomain[];
  confidence: number;
  errors?: string[];
}

export interface AsbuiltFieldMapping {
  [key: string]: string;
}

export interface AsbuiltDomainConfig {
  domain: AsbuiltDomain;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  fields: AsbuiltFieldMapping;
}

export const ASBUILT_DOMAINS: AsbuiltDomainConfig[] = [
  {
    domain: 'panel_placement',
    displayName: 'Panel Placement',
    description: 'Panel positioning and installation data',
    icon: '📍',
    color: '#3b82f6',
    fields: {
      'panel number': 'panelNumber',
      'panel id': 'panelNumber',
      'panel_id': 'panelNumber',
      'panel': 'panelNumber',
      'date': 'date',
      'time': 'time',
      'datetime': 'dateTime',
      'location': 'location',
      'location description': 'locationDescription',
      'location_description': 'locationDescription',
      'coordinates': 'coordinates',
      'x': 'xCoordinate',
      'y': 'yCoordinate',
      'length': 'length',
      'width': 'width',
      'area': 'area',
      'notes': 'notes'
    }
  },
  {
    domain: 'panel_seaming',
    displayName: 'Panel Seaming',
    description: 'Seam welding and joining data',
    icon: '🔗',
    color: '#10b981',
    fields: {
      'panel number': 'panelNumber',
      'panel id': 'panelNumber',
      'seam id': 'seamId',
      'seam_id': 'seamId',
      'seam type': 'seamType',
      'seam_type': 'seamType',
      'length': 'length',
      'width': 'width',
      'temperature': 'temperature',
      'speed': 'speed',
      'pressure': 'pressure',
      'date': 'date',
      'time': 'time',
      'operator': 'operator',
      'notes': 'notes'
    }
  },
  {
    domain: 'non_destructive',
    displayName: 'Non-Destructive Testing',
    description: 'NDT inspection and testing data',
    icon: '🔍',
    color: '#f59e0b',
    fields: {
      'panel number': 'panelNumber',
      'panel id': 'panelNumber',
      'test id': 'testId',
      'test_id': 'testId',
      'test type': 'testType',
      'test_type': 'testType',
      'result': 'result',
      'value': 'value',
      'unit': 'unit',
      'date': 'date',
      'time': 'time',
      'inspector': 'inspector',
      'notes': 'notes'
    }
  },
  {
    domain: 'trial_weld',
    displayName: 'Trial Welding',
    description: 'Trial weld testing and validation data',
    icon: '⚡',
    color: '#8b5cf6',
    fields: {
      'panel number': 'panelNumber',
      'panel id': 'panelNumber',
      'weld id': 'weldId',
      'weld_id': 'weldId',
      'material': 'material',
      'thickness': 'thickness',
      'temperature': 'temperature',
      'pressure': 'pressure',
      'speed': 'speed',
      'result': 'result',
      'date': 'date',
      'time': 'time',
      'operator': 'operator',
      'notes': 'notes'
    }
  },
  {
    domain: 'repairs',
    displayName: 'Repairs',
    description: 'Panel repair and maintenance data',
    icon: '🔧',
    color: '#ef4444',
    fields: {
      'panel number': 'panelNumber',
      'panel id': 'panelNumber',
      'repair id': 'repairId',
      'repair_id': 'repairId',
      'issue type': 'issueType',
      'issue_type': 'issueType',
      'description': 'description',
      'location': 'location',
      'location description': 'locationDescription',
      'location_description': 'locationDescription',
      'method': 'method',
      'material': 'material',
      'date': 'date',
      'time': 'time',
      'technician': 'technician',
      'status': 'status',
      'notes': 'notes'
    }
  },
  {
    domain: 'destructive',
    displayName: 'Destructive Testing',
    description: 'Destructive testing and analysis data',
    icon: '🧪',
    color: '#6b7280',
    fields: {
      'panel number': 'panelNumber',
      'panel id': 'panelNumber',
      'sample id': 'sampleId',
      'sample_id': 'sampleId',
      'test type': 'testType',
      'test_type': 'testType',
      'result': 'result',
      'value': 'value',
      'unit': 'unit',
      'standard': 'standard',
      'date': 'date',
      'time': 'time',
      'lab': 'lab',
      'technician': 'technician',
      'notes': 'notes'
    }
  }
];

export interface RightNeighborPeek {
  panelId: string;
  panelNumber: string;
  distance: number;
  confidence: number;
  lastUpdated: string;
}
