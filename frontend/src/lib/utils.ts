import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

export function isValidEmail(email: string): boolean {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email.toLowerCase());
}

export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    'pending': 'text-yellow-600',
    'in-progress': 'text-blue-600',
    'completed': 'text-green-600',
    'failed': 'text-red-600',
    'warning': 'text-amber-600',
    'passed': 'text-green-600',
  };
  
  return statusColors[status.toLowerCase()] || 'text-gray-600';
}

export function getStatusBgColor(status: string): string {
  const statusColors: Record<string, string> = {
    'pending': 'bg-yellow-50 text-yellow-700',
    'in-progress': 'bg-blue-50 text-blue-700',
    'completed': 'bg-green-50 text-green-700',
    'failed': 'bg-red-50 text-red-700',
    'warning': 'bg-amber-50 text-amber-700',
    'passed': 'bg-green-50 text-green-700',
  };
  
  return statusColors[status.toLowerCase()] || 'bg-gray-50 text-gray-700';
}