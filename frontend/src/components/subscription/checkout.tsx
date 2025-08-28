'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';
import { createCheckoutSession } from '@/lib/api';
import { getStripe } from '@/lib/stripe';

interface CheckoutProps {
  plan: 'basic' | 'premium';
  onCancel: () => void;
}

export default function Checkout({ plan, onCancel }: CheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  
  const planDetails = {
    basic: {
      name: 'Basic Plan',
      price: 115,
      description: 'Access to document uploads, dashboard, and manual QC data tools'
    },
    premium: {
      name: 'Premium Plan',
      price: 315,
      description: 'Everything in basic plus 2D automation, CAD integration, and AI analysis'
    }
  };
  
  const selectedPlan = planDetails[plan];
  
  const handleCheckout = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to subscribe',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Create checkout session on the server
      const response = await createCheckoutSession(plan);
      if (!response) {
        throw new Error('Failed to create checkout session');
      }
      const { sessionId } = response;
      
      // Redirect to Stripe checkout
      const stripe = await getStripe();
      if (!stripe) {
        throw new Error('Stripe failed to initialize');
      }
      
      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Something went wrong',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Failed',
        description: 'Unable to proceed to checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">{selectedPlan.name}</h3>
        <p className="text-sm text-gray-500">{selectedPlan.description}</p>
      </div>
      
      <div className="border-t border-b py-4">
        <div className="flex justify-between items-center">
          <span>Subscription fee</span>
          <span>${selectedPlan.price}/month</span>
        </div>
      </div>
      
      <div className="bg-gray-50 p-4 rounded-md">
        <h4 className="text-sm font-medium mb-2">What&apos;s included:</h4>
        {plan === 'basic' ? (
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Access to document uploads
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Dashboard and project management
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Manual QC data tools
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Basic reporting
            </li>
          </ul>
        ) : (
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Everything in Basic plan
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              2D automation features
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              CAD downloads and integration
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              AI document analysis
            </li>
            <li className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Real-time collaboration
            </li>
          </ul>
        )}
      </div>
      
      <div className="flex justify-end space-x-3">
        <Button 
          variant="outline" 
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleCheckout}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-b-transparent"></span>
              Processing...
            </>
          ) : (
            'Subscribe Now'
          )}
        </Button>
      </div>
      
      <div className="text-center text-xs text-gray-500 mt-4">
        <p>You will be redirected to Stripe for secure payment processing.</p>
        <p>Your subscription will renew automatically each month until canceled.</p>
      </div>
    </div>
  );
}
