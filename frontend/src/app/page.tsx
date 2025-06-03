'use client';

import Header from './components/landing/header';
import HeroSection from './components/landing/hero-section';
import FeaturesSection from './components/landing/features-section';
import PricingSection from './components/landing/pricing-section';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <div id="features">
        <FeaturesSection />
      </div>
      <div id="pricing">
        <PricingSection />
      </div>
      <footer className="bg-navy-900 text-white py-12">
        <div className="container mx-auto px-6 text-center">
          <p className="text-navy-300">
            © 2025 GeoSynth QC Pro. Professional Quality Control for Geosynthetic Projects.
          </p>
        </div>
      </footer>
    </div>
  );
}
