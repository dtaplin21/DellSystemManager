'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PricingCardProps {
  title: string;
  price: number;
  features: string[];
  highlighted?: boolean;
  isCurrentPlan?: boolean;
  onSelect: () => void;
  buttonText: string;
}

export default function PricingCard({
  title,
  price,
  features,
  highlighted = false,
  isCurrentPlan = false,
  onSelect,
  buttonText
}: PricingCardProps) {
  return (
    <Card className={`${highlighted ? 'border-blue-500 shadow-lg' : ''}`}>
      {highlighted && (
        <div className="bg-blue-500 text-white py-1 text-center text-sm font-medium">
          Recommended
        </div>
      )}
      <CardHeader>
        <div className={`${highlighted ? 'bg-blue-50' : ''}`}>
          <CardTitle>
            <div className="text-xl text-center">{title}</div>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-6">
          <div className="text-center mb-6">
            <span className="text-3xl font-bold">${price}</span>
            <span className="text-gray-500">/month</span>
          </div>
          
          <ul className="space-y-3 mb-8">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className={`mr-2 ${highlighted ? 'text-blue-500' : 'text-green-500'}`}
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span className="text-sm">{feature}</span>
              </li>
            ))}
          </ul>
          
          <Button
            className="w-full"
            variant={highlighted ? 'default' : 'outline'}
            onClick={onSelect}
            disabled={isCurrentPlan}
          >
            {buttonText}
          </Button>
          
          {isCurrentPlan && (
            <p className="text-center mt-2 text-sm text-blue-600">
              Your current plan
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
