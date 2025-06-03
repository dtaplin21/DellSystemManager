'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-navy-900">
              GeoSynth <span className="text-orange-600">QC Pro</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#features" className="text-gray-700 hover:text-navy-900 font-medium">
              Features
            </Link>
            <Link href="#pricing" className="text-gray-700 hover:text-navy-900 font-medium">
              Pricing
            </Link>
            <Link href="/panel-layout-demo" className="text-gray-700 hover:text-navy-900 font-medium">
              Demo
            </Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            <Link 
              href="/login" 
              className="text-navy-900 hover:text-navy-700 font-medium"
            >
              Sign In
            </Link>
            <Link 
              href="/signup" 
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}