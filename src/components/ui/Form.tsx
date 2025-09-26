'use client';

import React, { createContext, useContext, useCallback } from 'react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { z } from 'zod';
import { cn } from '@/lib/utils';

interface FormContextValue {
  errors: Array<{ field: string; message: string }>;
  isValid: boolean;
  touched: Set<string>;
  validateField: (field: string, value: any, schema: z.ZodSchema) => boolean;
  validateForm: (data: any, schema: z.ZodSchema) => boolean;
  setFieldTouched: (field: string) => void;
  clearErrors: () => void;
  getFieldError: (field: string) => string | undefined;
  hasFieldError: (field: string) => boolean;
}

const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a Form component');
  }
  return context;
}

interface FormProps {
  children: React.ReactNode;
  onSubmit: (data: any) => void;
  validationSchema?: z.ZodSchema;
  className?: string;
  initialValues?: Record<string, any>;
}

export function Form({ 
  children, 
  onSubmit, 
  validationSchema,
  className,
  initialValues = {}
}: FormProps) {
  const validation = useFormValidation();
  const [values, setValues] = React.useState(initialValues);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (validationSchema) {
      const isValid = validation.validateForm(values, validationSchema);
      if (!isValid) return;
    }
    
    onSubmit(values);
  }, [values, validationSchema, validation, onSubmit]);

  const setValue = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Auto-validate if schema is provided
    if (validationSchema) {
      validation.validateField(field, value, validationSchema);
    }
  }, [validationSchema, validation]);

  const contextValue: FormContextValue = {
    ...validation,
    setValue: (field: string, value: any) => setValue(field, value)
  } as FormContextValue;

  return (
    <FormContext.Provider value={contextValue}>
      <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
        {children}
      </form>
    </FormContext.Provider>
  );
}

interface FormFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  children: (props: {
    value: any;
    onChange: (value: any) => void;
    error?: string;
    hasError: boolean;
    touched: boolean;
    setTouched: () => void;
  }) => React.ReactNode;
}

export function FormField({ name, label, required, children }: FormFieldProps) {
  const { getFieldError, hasFieldError, setFieldTouched, touched } = useFormContext();
  const [value, setValue] = React.useState('');

  const handleChange = useCallback((newValue: any) => {
    setValue(newValue);
  }, []);

  const handleSetTouched = useCallback(() => {
    setFieldTouched(name);
  }, [name, setFieldTouched]);

  const error = getFieldError(name);
  const hasError = hasFieldError(name);
  const isTouched = touched.has(name);

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && (
            <span className="text-red-500 ml-1" aria-label="required">*</span>
          )}
        </label>
      )}
      {children({
        value,
        onChange: handleChange,
        error,
        hasError,
        touched: isTouched,
        setTouched: handleSetTouched
      })}
      {error && isTouched && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface FormSubmitProps {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function FormSubmit({ children, disabled, loading, className }: FormSubmitProps) {
  const { isValid } = useFormContext();
  
  return (
    <button
      type="submit"
      disabled={disabled || loading || !isValid}
      className={cn(
        'w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
        className
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </div>
      ) : (
        children
      )}
    </button>
  );
}
