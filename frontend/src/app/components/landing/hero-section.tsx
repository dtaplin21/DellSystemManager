'use client';

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-white py-20">
      <div className="container mx-auto px-6 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Professional Quality Control for{' '}
          <span className="text-orange-500">Geosynthetic Projects</span>
        </h1>
        <p className="text-xl text-navy-200 mb-8 max-w-3xl mx-auto">
          Streamline your QC workflows with AI-powered automation, intelligent panel optimization, 
          and comprehensive project management designed for geosynthetic engineering professionals.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/signup" 
            className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Start Free Trial
          </Link>
          <Link 
            href="/login" 
            className="border border-navy-300 hover:bg-navy-800 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Login to Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}