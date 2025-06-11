'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function AccountPage() {
  const { user, updateProfile, logout } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [company, setCompany] = useState(user?.company || '');
  const [position, setPosition] = useState(user?.position || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const subscriptionDetails = {
    basic: {
      name: 'Basic Plan',
      price: '$115/month',
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      features: [
        'Access to document uploads',
        'Dashboard and project management',
        'Manual QC data tools',
        'Basic reporting',
        'Email support'
      ]
    },
    premium: {
      name: 'Premium Plan',
      price: '$315/month',
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      features: [
        'Everything in Basic',
        '2D automation features',
        'CAD downloads and integration',
        'AI document analysis and suggestions',
        'Real-time collaboration',
        'Priority support'
      ]
    }
  };
  
  const userSubscription = user?.subscription || 'basic';
  const currentPlan = subscriptionDetails[userSubscription as keyof typeof subscriptionDetails];
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsUpdating(true);
    try {
      await updateProfile({ displayName: name, email, company, position });
      toast({
        title: 'Profile Updated',
        description: 'Your profile has been successfully updated.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Update Failed',
        description: 'There was an error updating your profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleCancelSubscription = async () => {
    try {
      // Placeholder for API call to cancel subscription
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setConfirmCancelOpen(false);
      
      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription has been cancelled. You will still have access until the end of your billing period.',
      });
      
      // Redirect to subscription page
      router.push('/dashboard/subscription');
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: 'Error',
        description: 'There was an error cancelling your subscription. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Account Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Information Section */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your account details and personal information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Full Name
                  </label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="company" className="text-sm font-medium">
                    Company Name
                  </label>
                  <Input
                    id="company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your Company"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="position" className="text-sm font-medium">
                    Job Title
                  </label>
                  <Input
                    id="position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Project Manager"
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Subscription Section */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded p-3">
                <div className="font-medium text-blue-800 mb-1">
                  {currentPlan.name}
                </div>
                <div className="text-sm text-blue-600">
                  {currentPlan.price}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="text-sm font-medium bg-green-100 text-green-800 py-0.5 px-2 rounded">
                    Active
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Next billing date</span>
                  <span className="text-sm font-medium">
                    {currentPlan.renewalDate}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Payment method</span>
                  <span className="text-sm font-medium">
                    •••• •••• •••• 4242
                  </span>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h4 className="text-sm font-medium mb-2">Included Features</h4>
                <ul className="space-y-1">
                  {currentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="pt-4 space-y-2">
                {userSubscription === 'basic' ? (
                  <Button
                    onClick={() => router.push('/dashboard/subscription')}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Upgrade to Premium
                  </Button>
                ) : (
                  <Button
                    onClick={() => router.push('/dashboard/subscription')}
                    className="w-full"
                  >
                    Manage Plan
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setConfirmCancelOpen(true)}
                >
                  Cancel Subscription
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Cancel Subscription Confirmation Dialog */}
      <Dialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription? You will still have access to all features until the end of your current billing period.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancelOpen(false)}>
              Keep Subscription
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelSubscription}
            >
              Yes, Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}