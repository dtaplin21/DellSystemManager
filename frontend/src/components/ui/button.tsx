'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border-2 shadow-sm hover:shadow transform hover:translate-y-[-1px]';
    
    const variants = {
      default: 'bg-[#0052cc] text-white hover:bg-[#003d99] border-[#003d99]',
      destructive: 'bg-[#ff5630] text-white hover:bg-[#de350b] border-[#de350b]',
      outline: 'border-[#dfe1e6] bg-white hover:bg-[#f5f8fa] text-[#6b778c]',
      secondary: 'bg-[#f5f8fa] text-[#172b4d] hover:bg-[#ebecf0] border-[#dfe1e6]',
      ghost: 'hover:bg-[#f5f8fa] hover:text-[#172b4d] text-[#6b778c] border-transparent',
      link: 'text-[#0052cc] underline-offset-4 hover:underline border-transparent shadow-none',
    };
    
    const sizes = {
      default: 'h-10 py-2 px-4',
      sm: 'h-8 py-1 px-3 text-sm',
      lg: 'h-12 py-3 px-6 text-lg',
    };

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };