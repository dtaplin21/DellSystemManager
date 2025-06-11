import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

interface CardContentProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

interface CardFooterProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
  return (
    <footer className={`px-6 py-4 border-t border-gray-200 ${className}`} {...props}>
      {children}
    </footer>
  );
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

export function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
  return (
    <header className={`px-6 py-4 border-b border-gray-200 ${className}`} {...props}>
      {children}
    </header>
  );
}

export function CardContent({ children, className = '', ...props }: CardContentProps) {
  return (
    <section className={`p-6 ${className}`} {...props}>
      {children}
    </section>
  );
}

export function CardTitle({ children, className = '', ...props }: CardTitleProps) {
  return (
    <h2 className={`text-lg font-medium text-gray-900 ${className}`} {...props}>
      {children}
    </h2>
  );
}

export function CardDescription({ children, className = '', ...props }: CardDescriptionProps) {
  return (
    <p className={`text-sm text-gray-600 mt-1 ${className}`} {...props}>
      {children}
    </p>
  );
}