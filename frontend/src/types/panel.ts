// Canonical Panel type for the entire frontend
export type Panel = {
  id: string;
  date: string;
  panelNumber: string;
  length: number;
  width: number;
  rollNumber: string;
  location: string;
  x: number;
  y: number;
  shape: 'rectangle' | 'triangle' | 'right-triangle' | 'circle';
  points?: number[];
  radius?: number;
  rotation: number;
  fill: string;
  color: string;
}; 