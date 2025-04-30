import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
}

export function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'text-green-600';
    case 'completed':
      return 'text-blue-600';
    case 'on hold':
      return 'text-yellow-600';
    case 'pending':
      return 'text-orange-600';
    case 'failed':
    case 'error':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export function getStatusBgColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100';
    case 'completed':
      return 'bg-blue-100';
    case 'on hold':
      return 'bg-yellow-100';
    case 'pending':
      return 'bg-orange-100';
    case 'failed':
    case 'error':
      return 'bg-red-100';
    default:
      return 'bg-gray-100';
  }
}
