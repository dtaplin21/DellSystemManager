'use client';

import { useEffect } from 'react';
import { redirect } from 'next/navigation';

export default function Home() {
  // Immediate redirect to dashboard
  useEffect(() => {
    window.location.replace('/dashboard');
  }, []);

  // This should not render, but just in case
  return null;
}
