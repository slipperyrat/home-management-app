'use client';

import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';

export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormValidationState {
  errors: FormFieldError[];
  isValid: boolean;
  touched: Set<string>;
}

export interface FormValidation {
  errors: FormFieldError[];
  isValid: boolean;
  touched: Set<string>;
  validateField: (field: string, value: any, schema: z.ZodSchema) => boolean;
  validateForm: (data: any, schema: z.ZodSchema) => boolean;
  setFieldTouched: (field: string) => void;
  clearErrors: () => void;
  getFieldError: (field: string) => string | undefined;
  hasFieldError: (field: string) => boolean;
}

export function useFormValidation(): FormValidation {
  const [state, setState] = useState<FormValidationState>({
    errors: [],
    isValid: true,
    touched: new Set()
  });

  const validateField = useCallback((field: string, value: any, schema: z.ZodSchema): boolean => {
    try {
      // Create a partial schema for just this field
      const fieldSchema = schema.pick({ [field]: true } as any);
      fieldSchema.parse({ [field]: value });
      
      // Remove error for this field if validation passes
      setState(prev => ({
        ...prev,
        errors: prev.errors.filter(error => error.field !== field),
        isValid: prev.errors.filter(error => error.field !== field).length === 0
      }));
      
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors.find(err => err.path.includes(field));
        if (fieldError) {
          setState(prev => ({
            ...prev,
            errors: [
              ...prev.errors.filter(err => err.field !== field),
              { field, message: fieldError.message }
            ],
            isValid: false
          }));
        }
      }
      return false;
    }
  }, []);

  const validateForm = useCallback((data: any, schema: z.ZodSchema): boolean => {
    try {
      schema.parse(data);
      setState(prev => ({
        ...prev,
        errors: [],
        isValid: true
      }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: FormFieldError[] = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        
        setState(prev => ({
          ...prev,
          errors,
          isValid: false
        }));
      }
      return false;
    }
  }, []);

  const setFieldTouched = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      touched: new Set([...prev.touched, field])
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: [],
      isValid: true
    }));
  }, []);

  const getFieldError = useCallback((field: string): string | undefined => {
    return state.errors.find(error => error.field === field)?.message;
  }, [state.errors]);

  const hasFieldError = useCallback((field: string): boolean => {
    return state.errors.some(error => error.field === field);
  }, [state.errors]);

  return {
    errors: state.errors,
    isValid: state.isValid,
    touched: state.touched,
    validateField,
    validateForm,
    setFieldTouched,
    clearErrors,
    getFieldError,
    hasFieldError
  };
}

// Hook for form state management with validation
export function useFormState<T extends Record<string, any>>(
  initialValues: T,
  validationSchema?: z.ZodSchema
) {
  const [values, setValues] = useState<T>(initialValues);
  const validation = useFormValidation();

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Auto-validate if schema is provided
    if (validationSchema) {
      validation.validateField(field as string, value, validationSchema);
    }
  }, [validationSchema, validation]);

  const setFieldTouched = useCallback((field: keyof T) => {
    validation.setFieldTouched(field as string);
  }, [validation]);

  const reset = useCallback(() => {
    setValues(initialValues);
    validation.clearErrors();
  }, [initialValues, validation]);

  const validate = useCallback(() => {
    if (validationSchema) {
      return validation.validateForm(values, validationSchema);
    }
    return true;
  }, [values, validationSchema, validation]);

  return {
    values,
    setValue,
    setFieldTouched,
    reset,
    validate,
    ...validation
  };
}
