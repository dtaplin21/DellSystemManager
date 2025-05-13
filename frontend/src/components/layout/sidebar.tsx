'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, FolderOpen, FileText, Settings, UserCircle, CreditCard, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Define TypeScript interfaces
interface NavigationItem {
  name?: string;
  href?: string;
  icon?: LucideIcon;
  current: boolean;
  section?: string;
  items?: NavigationSubItem[];
}

interface NavigationSubItem {
  name: string;
  href: string;
  icon: LucideIcon;
  current: boolean;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string): boolean => {
    return Boolean(pathname === path || pathname?.startsWith(path + '/'));
  };

  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: isActive('/dashboard') && pathname === '/dashboard'
    },
    {
      name: 'Projects',
      href: '/dashboard/projects',
      icon: FolderOpen,
      current: isActive('/dashboard/projects')
    },
    {
      name: 'Documents',
      href: '/dashboard/documents',
      icon: FileText,
      current: isActive('/dashboard/documents')
    },
    {
      section: 'Account',
      items: [
        {
          name: 'Account Settings',
          href: '/dashboard/account',
          icon: UserCircle,
          current: isActive('/dashboard/account')
        },
        {
          name: 'Subscription',
          href: '/dashboard/subscription',
          icon: CreditCard,
          current: isActive('/dashboard/subscription')
        },
        {
          name: 'Settings',
          href: '/dashboard/settings',
          icon: Settings,
          current: isActive('/dashboard/settings')
        }
      ]
    }
  ];

  return (
    <div className="bg-white border-r border-gray-200 w-64 min-h-screen hidden md:block">
      <div className="h-full py-6 px-3">
        <div className="space-y-6">
          {navigation.map((item, index) => (
            <div key={index}>
              {/* Regular menu item */}
              {item.name && item.href && (
                <Link 
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                    item.current 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {item.icon && <item.icon className="mr-3 h-5 w-5" />}
                  {item.name}
                </Link>
              )}
              
              {/* Section with sub-items */}
              {item.section && item.items && (
                <div>
                  <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {item.section}
                  </h3>
                  <ul className="space-y-1">
                    {item.items.map((subItem, subIndex) => (
                      <li key={subIndex}>
                        <Link 
                          href={subItem.href}
                          className={cn(
                            "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                            subItem.current 
                              ? "bg-blue-50 text-blue-700" 
                              : "text-gray-700 hover:bg-gray-100"
                          )}
                        >
                          {subItem.icon && <subItem.icon className="mr-3 h-5 w-5" />}
                          {subItem.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
