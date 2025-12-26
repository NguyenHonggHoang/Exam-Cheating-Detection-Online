import React from 'react';

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  name?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  onValueChange,
  children,
  className = '',
  name
}) => {
  // Use context to pass value/onChange to RadioGroupItem without cloning
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
      <div className={`space-y-2 ${className}`} role="radiogroup">
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
};

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  value: string;
}

export const RadioGroupItem: React.FC<RadioGroupItemProps> = ({
  className = '',
  value,
  id,
  ...props
}) => {
  const context = React.useContext(RadioGroupContext);

  if (!context) {
    console.error('[RadioGroupItem] Must be used within a RadioGroup');
    return null;
  }

  const { value: groupValue, onValueChange, name } = context;
  const isChecked = groupValue === value;

  return (
    <input
      type="radio"
      id={id}
      name={name || 'radio-group'}
      value={value}
      checked={isChecked}
      onChange={() => {
        console.log(`[RadioGroup] Selected: ${value}`);
        onValueChange(value);
      }}
      className={`h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600 cursor-pointer ${className}`}
      {...props}
    />
  );
};
