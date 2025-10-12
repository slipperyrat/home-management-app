'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useFormValidation } from '@/hooks/useFormValidation';
import { z } from 'zod';
import { cn } from '@/lib/utils';

interface FormContextValue {
  errors: Array<{ field: string; message: string }>;
  isValid: boolean;
  touched: Set<string>;
  validateField: (field: string, value: unknown, schema: z.AnyZodObject) => boolean;
  validateForm: (data: Record<string, unknown>, schema: z.AnyZodObject) => boolean;
  setFieldTouched: (field: string) => void;
  clearErrors: () => void;
  getFieldError: (field: string) => string | undefined;
  hasFieldError: (field: string) => boolean;
  setValue: (field: string, value: unknown) => void;
  getValue: (field: string) => unknown;
}

const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a Form component');
  }
  return context;
}

interface FormProps<TValues extends Record<string, unknown>> {
  children: React.ReactNode;
  onSubmit: (data: TValues) => void;
  validationSchema?: z.AnyZodObject;
  className?: string;
  initialValues?: TValues;
}

export function Form<TValues extends Record<string, unknown>>({
  children,
  onSubmit,
  validationSchema,
  className,
  initialValues = {} as TValues,
}: FormProps<TValues>) {
  const validation = useFormValidation();
  const [values, setValues] = React.useState<TValues>(initialValues);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (validationSchema) {
      const isValid = validation.validateForm(values, validationSchema);
      if (!isValid) return;
    }

    onSubmit(values);
  }, [values, validationSchema, validation, onSubmit]);

  const setValue = useCallback((field: string, value: unknown) => {
    setValues(prev => ({ ...prev, [field]: value }));

    if (validationSchema) {
      validation.validateField(field, value, validationSchema);
    }
  }, [validationSchema, validation]);

  const getValue = useCallback((field: string) => values[field as keyof TValues], [values]);

  const contextValue = useMemo<FormContextValue>(() => ({
    errors: validation.errors,
    isValid: validation.isValid,
    touched: validation.touched,
    validateField: validation.validateField,
    validateForm: validation.validateForm,
    setFieldTouched: validation.setFieldTouched,
    clearErrors: validation.clearErrors,
    getFieldError: validation.getFieldError,
    hasFieldError: validation.hasFieldError,
    setValue,
    getValue,
  }), [validation, setValue, getValue]);

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
    value: unknown;
    onChange: (value: unknown) => void;
    error?: string;
    hasError: boolean;
    touched: boolean;
    setTouched: () => void;
  }) => React.ReactNode;
}

export function FormField({ name, label, required, children }: FormFieldProps) {
  const { getFieldError, hasFieldError, setFieldTouched, touched, setValue, getValue } = useFormContext();

  const handleChange = useCallback((newValue: unknown) => {
    setValue(name, newValue);
  }, [name, setValue]);

  const handleSetTouched = useCallback(() => {
    setFieldTouched(name);
  }, [name, setFieldTouched]);

  const error = getFieldError(name);
  const hasError = hasFieldError(name);
  const isTouched = touched.has(name);
  const value = getValue(name);

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700" htmlFor={name}>
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
        setTouched: handleSetTouched,
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
