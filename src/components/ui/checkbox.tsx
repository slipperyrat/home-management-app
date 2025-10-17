import React from 'react';
import { cn } from '@/lib/utils';

type NativeCheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>;

interface CheckboxProps extends NativeCheckboxProps {
  label?: string;
  description?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
}

export function Checkbox({ 
  className = '', 
  label,
  description,
  error,
  size = 'md',
  id,
  onCheckedChange,
  onChange,
  indeterminate = false,
  ...props 
}: CheckboxProps) {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
  
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  const labelSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
  
  const classes = cn(
    'rounded border border-input bg-background text-primary shadow-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
    sizeClasses[size],
    className
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Call the standard onChange if provided
    if (onChange) {
      onChange(event);
    }
    
    // Call the onCheckedChange if provided
    if (onCheckedChange) {
      onCheckedChange(event.target.checked);
    }
  };
  
  return (
    <div className="flex items-start space-x-2">
      <div className="flex items-center h-5">
        <input
          type="checkbox"
          id={checkboxId}
          className={classes}
          onChange={handleChange}
          {...props}
          ref={(element) => {
            if (element) {
              element.indeterminate = indeterminate;
            }
          }}
        />
      </div>
      {(label || description) && (
        <div className="flex flex-col space-y-1">
          {label && (
            <label 
              htmlFor={checkboxId}
              className={cn(
                'font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                labelSizeClasses[size]
              )}
            >
              {label}
            </label>
          )}
          {description && (
            <p className={cn(
              'text-muted-foreground',
              size === 'sm' ? 'text-xs' : 'text-sm'
            )}>
              {description}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Export a simple checkbox without label for cases where you just need the input
export function CheckboxInput({ 
  className = '', 
  size = 'md',
  onCheckedChange,
  onChange,
  ...props 
}: Omit<CheckboxProps, 'label' | 'description' | 'error'>) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  const classes = cn(
    'rounded border border-input bg-background text-primary shadow-sm transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
    sizeClasses[size],
    className
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Call the standard onChange if provided
    if (onChange) {
      onChange(event);
    }
    
    // Call the onCheckedChange if provided
    if (onCheckedChange) {
      onCheckedChange(event.target.checked);
    }
  };
  
  return (
    <input
      type="checkbox"
      className={classes}
      onChange={handleChange}
      {...props}
    />
  );
}
