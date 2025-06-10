export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  company?: string;
  position?: string;
  subscription?: 'basic' | 'premium';
} 