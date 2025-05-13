'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';

export default function SubscriptionConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // Get status from query params
  const success = searchParams.get('success') === 'true';
  const plan = searchParams.get('plan') || 'premium'; // Default to premium
  
  useEffect(() => {
    // Give a moment for the success animation and then set not loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Get plan details
  const planDetails = {
    basic: {
      name: 'Basic Plan',
      price: '$115/month',
      featuresEnabled: [
        'Access to document uploads',
        'Dashboard and project management',
        'Manual QC data tools',
        'Basic reporting',
        'Email support'
      ],
      featuresDisabled: [
        '2D automation features',
        'CAD downloads and integration',
        'AI document analysis and suggestions',
        'Real-time collaboration',
        'Priority support'
      ]
    },
    premium: {
      name: 'Premium Plan',
      price: '$315/month',
      featuresEnabled: [
        'Access to document uploads',
        'Dashboard and project management',
        'Manual QC data tools',
        'Basic reporting',
        'Email support',
        '2D automation features',
        'CAD downloads and integration',
        'AI document analysis and suggestions',
        'Real-time collaboration',
        'Priority support'
      ],
      featuresDisabled: []
    }
  };
  
  const selectedPlan = plan === 'basic' ? planDetails.basic : planDetails.premium;
  
  // If not successful, show error
  if (!success) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl text-center text-red-600">
            Subscription Error
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          
          <p className="mb-6">
            There was an issue with your subscription. The payment may not have been processed successfully.
          </p>
          
          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={() => router.push('/dashboard/subscription')}>
              Try Again
            </Button>
            <Button onClick={() => router.push('/dashboard')}>
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Show success page
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl text-center text-green-600">
          Subscription Activated
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        {isLoading ? (
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
        
        <h2 className="text-2xl font-bold mb-2">
          Thank you for subscribing to {selectedPlan.name}!
        </h2>
        
        <p className="text-gray-600 mb-6">
          Your subscription is now active and you have access to all {plan === 'premium' ? 'Premium' : 'Basic'} features.
        </p>
        
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <div className="mb-4">
            <h3 className="font-semibold text-lg">Subscription Details</h3>
            <p className="text-gray-600">
              {selectedPlan.name} - {selectedPlan.price}
            </p>
          </div>
          
          <div className="text-left">
            <h3 className="font-semibold mb-2">Features Include:</h3>
            <ul className="space-y-1">
              {selectedPlan.featuresEnabled.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
              
              {selectedPlan.featuresDisabled.map((feature, index) => (
                <li key={index} className="flex items-start text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard/account')}
            className="sm:flex-1"
          >
            Manage Subscription
          </Button>
          <Button 
            onClick={() => router.push('/dashboard')} 
            className="bg-blue-600 hover:bg-blue-700 sm:flex-1"
          >
            Go to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}