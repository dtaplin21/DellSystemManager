'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { loadStripe } from '@stripe/stripe-js';

// NOTE: For the actual implementation, this would use the Stripe keys
// from the environment variables. For this demo, we'll handle checkout internally
// rather than making actual Stripe API calls.

export default function SubscriptionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'premium'>(
    user?.subscription as 'basic' | 'premium' || 'basic'
  );
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(false);

  // Define plan features and pricing
  const plans = {
    basic: {
      name: 'Basic Plan',
      description: 'Essential tools for geosynthetic QC management',
      price: {
        monthly: 115,
        yearly: 1150, // 10 months for the price of 12
      },
      features: [
        'Project dashboard',
        'Document storage (25 projects)',
        'Manual QC data entry',
        'Basic reporting',
        'Email support',
      ],
      disabledFeatures: [
        'AI document analysis',
        'QC data anomaly detection',
        'Panel layout automation',
        'Premium reporting',
        'CAD integration',
        'Real-time collaboration',
        'Priority support',
      ],
    },
    premium: {
      name: 'Premium Plan',
      description: 'Advanced tools with AI-powered automation',
      price: {
        monthly: 315,
        yearly: 3150, // 10 months for the price of 12
      },
      features: [
        'Project dashboard',
        'Document storage (unlimited projects)',
        'Manual QC data entry',
        'Advanced reporting',
        'AI document analysis',
        'QC data anomaly detection',
        'Panel layout automation',
        'Premium reporting',
        'CAD integration',
        'Real-time collaboration',
        'Priority support',
      ],
      disabledFeatures: [],
    },
  };

  // Handle plan selection
  const handlePlanSelect = (plan: 'basic' | 'premium') => {
    setSelectedPlan(plan);
  };

  // Handle subscription checkout
  const handleCheckout = async () => {
    setIsLoading(true);

    try {
      // In a real implementation, this would create a Stripe Checkout session on your backend
      // For now, we'll simulate this and redirect to the confirmation page
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Redirect to confirmation page with success
      router.push(`/dashboard/subscription/confirmation?success=true&plan=${selectedPlan}`);
    } catch (error) {
      console.error('Error during checkout:', error);
      toast({
        title: 'Checkout Failed',
        description: 'There was an error processing your subscription. Please try again.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  // Calculate savings for yearly billing
  const calculateSavings = (plan: 'basic' | 'premium') => {
    const monthlyPrice = plans[plan].price.monthly;
    const yearlyPrice = plans[plan].price.yearly;
    const monthlyCost = monthlyPrice * 12;
    const saving = monthlyCost - yearlyPrice;
    return saving;
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Subscription Plans</h1>
        <p className="text-gray-500">
          Choose the plan that best fits your needs. All plans include access to basic features.
        </p>
      </div>

      <div className="flex justify-center mb-10">
        <Tabs
          defaultValue="monthly"
          value={billingInterval}
          onValueChange={(value) => setBillingInterval(value as 'monthly' | 'yearly')}
          className="w-full max-w-md"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">
              Yearly{' '}
              <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                Save 16%
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Basic Plan */}
        <Card className={`relative overflow-hidden ${selectedPlan === 'basic' ? 'ring-2 ring-blue-600' : ''}`}>
          {selectedPlan === 'basic' && (
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-sm font-medium">
              Selected
            </div>
          )}
          <CardHeader>
            <CardTitle className="text-xl">
              {plans.basic.name}{' '}
              {user?.subscription === 'basic' && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">Current Plan</span>
              )}
            </CardTitle>
            <CardDescription className="mt-2">{plans.basic.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <span className="text-3xl font-bold">${plans.basic.price[billingInterval]}</span>
              <span className="text-gray-500 ml-2">/{billingInterval === 'monthly' ? 'month' : 'year'}</span>
              {billingInterval === 'yearly' && (
                <div className="text-sm text-green-600 mt-1">
                  Save ${calculateSavings('basic')} per year
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Included Features</h3>
                <ul className="space-y-2">
                  {plans.basic.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-green-600 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-medium mb-2">Not Included</h3>
                <ul className="space-y-2">
                  {plans.basic.disabledFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-gray-400 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            {user?.subscription === 'basic' ? (
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Current Plan
              </Button>
            ) : (
              <Button
                className={selectedPlan === 'basic' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                onClick={() => handlePlanSelect('basic')}
              >
                {selectedPlan === 'basic' ? 'Selected' : 'Select Basic'}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Premium Plan */}
        <Card className={`relative overflow-hidden ${selectedPlan === 'premium' ? 'ring-2 ring-blue-600' : ''}`}>
          {selectedPlan === 'premium' && (
            <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-sm font-medium">
              Selected
            </div>
          )}
          <CardHeader>
            <div className="absolute top-0 right-0 bg-blue-100 text-blue-800 px-3 py-1 text-sm font-medium rounded-bl-lg">
              Popular
            </div>
            <CardTitle className="text-xl">
              {plans.premium.name}{' '}
              {user?.subscription === 'premium' && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 rounded-full px-2 py-0.5">Current Plan</span>
              )}
            </CardTitle>
            <CardDescription className="mt-2">{plans.premium.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <span className="text-3xl font-bold">${plans.premium.price[billingInterval]}</span>
              <span className="text-gray-500 ml-2">/{billingInterval === 'monthly' ? 'month' : 'year'}</span>
              {billingInterval === 'yearly' && (
                <div className="text-sm text-green-600 mt-1">
                  Save ${calculateSavings('premium')} per year
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">Included Features</h3>
                <ul className="space-y-2">
                  {plans.premium.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 text-green-600 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            {user?.subscription === 'premium' ? (
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Current Plan
              </Button>
            ) : (
              <Button
                className={selectedPlan === 'premium' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}
                onClick={() => handlePlanSelect('premium')}
              >
                {selectedPlan === 'premium' ? 'Selected' : 'Select Premium'}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <div className="mt-12 text-center">
        {selectedPlan && (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">
              {user?.subscription === selectedPlan
                ? 'You are already subscribed to this plan'
                : `Subscribe to ${plans[selectedPlan].name}`}
            </h2>
            
            {user?.subscription !== selectedPlan && (
              <>
                <p className="text-gray-500 mb-6">
                  {`You will be charged $${plans[selectedPlan].price[billingInterval]} ${billingInterval === 'monthly' ? 'per month' : 'per year'} for the ${plans[selectedPlan].name}.`}
                </p>
                
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading || user?.subscription === selectedPlan}
                  onClick={handleCheckout}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    'Subscribe Now'
                  )}
                </Button>
                
                <p className="text-xs text-gray-500 mt-4">
                  By subscribing, you agree to our Terms of Service and Privacy Policy.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}