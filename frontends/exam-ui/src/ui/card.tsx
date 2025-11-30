import React from 'react';

export const Card: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
    {children}
  </div>
);

export const CardHeader: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className = '' }) => (
  <div className={`p-6 ${className}`}>
    {children}
  </div>
);

export const CardTitle: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
);

// ← THÊM MỚI: CardDescription
export const CardDescription: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-600 mt-1 ${className}`}>
    {children}
  </p>
);

export const CardContent: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className = '' }) => (
  <div className={`p-6 pt-0 ${className}`}>
    {children}
  </div>
);

// ← THÊM MỚI: CardFooter
export const CardFooter: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className = '' }) => (
  <div className={`p-6 pt-0 ${className}`}>
    {children}
  </div>
);
