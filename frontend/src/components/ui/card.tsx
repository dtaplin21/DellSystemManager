import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface CardHeaderProps {
  children: React.ReactNode;
}

interface CardContentProps {
  children: React.ReactNode;
}

interface CardTitleProps {
  children: React.ReactNode;
}

interface CardDescriptionProps {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div 
      className={`bg-white shadow rounded-lg border ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: CardHeaderProps) {
  return (
    <header className="px-6 py-4 border-b border-gray-200">
      {children}
    </header>
  );
}

export function CardContent({ children }: CardContentProps) {
  return (
    <section className="p-6">
      {children}
    </section>
  );
}

export function CardTitle({ children }: CardTitleProps) {
  return (
    <h2 className="text-lg font-medium text-gray-900">
      {children}
    </h2>
  );
}

export function CardDescription({ children }: CardDescriptionProps) {
  return (
    <p className="text-sm text-gray-600 mt-1">
      {children}
    </p>
  );
}