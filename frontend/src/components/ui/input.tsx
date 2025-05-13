'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border-2 border-[#dfe1e6] bg-[#fff] px-3 py-2 text-sm ring-offset-white shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#6b778c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:border-[#0052cc] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:border-[#0052cc] transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };