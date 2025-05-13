'use client';

import React from 'react';
import { Button } from './button';
import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed border-[#dfe1e6] rounded-xl bg-[#fcfcfc]">
      {icon && (
        <div className="w-20 h-20 bg-[#f5f8fa] rounded-full flex items-center justify-center mb-6 border-2 border-[#dfe1e6] shadow-sm">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-semibold text-[#172b4d] mb-3">{title}</h3>
      <p className="text-sm text-[#6b778c] max-w-md mb-6 border border-[#dfe1e6] rounded-md py-2 px-4 bg-[#f9fafc]">{description}</p>
      
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button className="bg-[#0052cc] hover:bg-[#003d99] text-white border-2 border-[#003d99] shadow-sm transition-all duration-200 hover:shadow transform hover:translate-y-[-1px]">
              {action.label}
            </Button>
          </Link>
        ) : (
          <Button 
            onClick={action.onClick} 
            className="bg-[#0052cc] hover:bg-[#003d99] text-white border-2 border-[#003d99] shadow-sm transition-all duration-200 hover:shadow transform hover:translate-y-[-1px]"
          >
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}