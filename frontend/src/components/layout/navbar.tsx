'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      if (user) {
        await logout();
      }
      // Simply refresh the page rather than pushing to login
      // since we've removed login restrictions
      router.refresh();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <nav className="bg-navy-900 border-b border-navy-700 py-4 px-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/dashboard" className="text-xl font-bold text-orange-500">
            GeoQC
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-navy-100 hover:text-orange-400 hover:bg-navy-800"
            onClick={() => window.location.href = '/dashboard'}
          >
            Dashboard
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm"
            className="text-navy-100 hover:text-orange-400 hover:bg-navy-800"
            onClick={() => window.location.href = '/dashboard/projects'}
          >
            Projects
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-navy-100 hover:text-orange-400 hover:bg-navy-800">
                <div className="h-8 w-8 rounded-full bg-orange-600 flex items-center justify-center text-white">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'G'}
                </div>
                <span className="hidden md:inline">{user?.displayName || user?.email || 'Guest User'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/account')}>
                Account Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/subscription')}>
                Subscription
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}
