import React from 'react';

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  onValueChange,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            checked: child.props.value === value,
            onChange: () => onValueChange(child.props.value)
          } as any);
        }
        return child;
      })}
    </div>
  );
};

interface RadioGroupItemProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

export const RadioGroupItem: React.FC<RadioGroupItemProps> = ({
  className = '',
  ...props
}) => {
  return (
    <input
      type="radio"
      className={`h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600 ${className}`}
      {...props}
    />
  );
};
