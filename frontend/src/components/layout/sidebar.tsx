'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, FolderOpen, FileText, Settings, UserCircle, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(path + '/');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: isActive('/dashboard')
    },
    {
      name: 'Projects',
      href: '/dashboard/projects',
      icon: FolderOpen,
      current: isActive('/dashboard/projects')
    },
    {
      name: 'Profile',
      href: '/dashboard/profile',
      icon: UserCircle,
      current: isActive('/dashboard/profile')
    },
    {
      name: 'Subscription',
      href: '/dashboard/subscription',
      icon: CreditCard,
      current: isActive('/dashboard/subscription')
    }
  ];

  return (
    <div className="bg-white border-r border-gray-200 w-64 min-h-screen hidden md:block">
      <div className="h-full py-6 px-3">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.name}>
              <Link 
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                  item.current 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
