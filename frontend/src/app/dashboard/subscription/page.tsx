'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import PricingCard from '@/components/subscription/pricing-card';
import Checkout from '@/components/subscription/checkout';

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium' | null>(null);

  const basicFeatures = [
    'Access to document uploads',
    'Dashboard and project management',
    'Manual QC data tools',
    'Basic reporting',
    'Email support'
  ];

  const premiumFeatures = [
    'Everything in Basic',
    '2D automation features',
    'CAD downloads and integration',
    'AI document analysis and suggestions',
    'Real-time collaboration',
    'Priority support'
  ];

  const currentPlan = user?.subscription || 'basic';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscription Plans</h1>
      
      {!selectedPlan ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PricingCard
            title="Basic Plan"
            price={115}
            features={basicFeatures}
            isCurrentPlan={currentPlan === 'basic'}
            onSelect={() => setSelectedPlan('basic')}
            buttonText={currentPlan === 'basic' ? 'Current Plan' : 'Select Plan'}
          />
          
          <PricingCard
            title="Premium Plan"
            price={315}
            features={premiumFeatures}
            highlighted={true}
            isCurrentPlan={currentPlan === 'premium'}
            onSelect={() => setSelectedPlan('premium')}
            buttonText={currentPlan === 'premium' ? 'Current Plan' : 'Select Plan'}
          />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedPlan === 'basic' ? 'Basic Plan - $115/month' : 'Premium Plan - $315/month'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Checkout plan={selectedPlan} onCancel={() => setSelectedPlan(null)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
