'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, FolderOpen, FileText, FileSpreadsheet, Settings, UserCircle, CreditCard, TestTube, LucideIcon } from 'lucide-react';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string): boolean => {
    if (!mounted) return false; // Prevent hydration mismatch
    return Boolean(pathname === path || pathname?.startsWith(path + '/'));
  };

  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      current: Boolean(isActive('/dashboard') && pathname === '/dashboard')
    },
    {
      name: 'Projects',
      href: '/dashboard/projects',
      icon: FolderOpen,
      current: Boolean(isActive('/dashboard/projects'))
    },
    {
      name: 'Documents',
      href: '/dashboard/documents',
      icon: FileText,
      current: Boolean(isActive('/dashboard/documents'))
    },
    {
      section: 'Development',
      current: false, // Section header is never active
      items: [
        {
          name: 'Phase 5 Testing',
          href: '/dashboard/phase5-testing',
          icon: TestTube,
          current: Boolean(isActive('/dashboard/phase5-testing'))
        }
      ]
    },
    {
      section: 'Account',
      current: false, // Section header is never active
      items: [
        {
          name: 'Account Settings',
          href: '/dashboard/account',
          icon: UserCircle,
          current: Boolean(isActive('/dashboard/account'))
        },
        {
          name: 'Subscription',
          href: '/dashboard/subscription',
          icon: CreditCard,
          current: Boolean(isActive('/dashboard/subscription'))
        },
        {
          name: 'Settings',
          href: '/dashboard/settings',
          icon: Settings,
          current: Boolean(isActive('/dashboard/settings'))
        }
      ]
    }
  ];

  return (
    <div className="bg-navy-800 border-r border-navy-700 w-64 min-h-screen hidden md:block">
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
                      ? "bg-orange-600 text-white" 
                      : "text-navy-100 hover:bg-navy-700 hover:text-orange-400"
                  )}
                >
                  {item.icon && <item.icon className="mr-3 h-5 w-5" />}
                  {item.name}
                </Link>
              )}
              
              {/* Section with sub-items */}
              {item.section && item.items && (
                <div>
                  <h3 className="px-3 text-xs font-semibold text-navy-300 uppercase tracking-wider mb-2">
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
                              ? "bg-orange-600 text-white" 
                              : "text-navy-100 hover:bg-navy-700 hover:text-orange-400"
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
