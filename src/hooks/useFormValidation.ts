'use client';

import { useState, useCallback } from 'react';
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
  validateField: (field: string, value: unknown, schema: z.AnyZodObject) => boolean;
  validateForm: (data: Record<string, unknown>, schema: z.AnyZodObject) => boolean;
  setFieldTouched: (field: string) => void;
  clearErrors: () => void;
  getFieldError: (field: string) => string | undefined;
  hasFieldError: (field: string) => boolean;
}

export function useFormValidation(): FormValidation {
  const [state, setState] = useState<FormValidationState>({
    errors: [],
    isValid: true,
    touched: new Set(),
  });

  const validateField = useCallback((field: string, value: unknown, schema: z.AnyZodObject): boolean => {
    try {
      const fieldSchema = schema.pick({ [field]: true });
      fieldSchema.parse({ [field]: value });

      setState((prev) => ({
        ...prev,
        errors: prev.errors.filter((error) => error.field !== field),
        isValid: prev.errors.filter((error) => error.field !== field).length === 0,
      }));

      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors.find((err) => err.path.includes(field));
        if (fieldError) {
          setState((prev) => ({
            ...prev,
            errors: [
              ...prev.errors.filter((err) => err.field !== field),
              { field, message: fieldError.message },
            ],
            isValid: false,
          }));
        }
      }
      return false;
    }
  }, []);

  const validateForm = useCallback((data: Record<string, unknown>, schema: z.AnyZodObject): boolean => {
    try {
      schema.parse(data);
      setState((prev) => ({
        ...prev,
        errors: [],
        isValid: true,
      }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: FormFieldError[] = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        setState((prev) => ({
          ...prev,
          errors,
          isValid: false,
        }));
      }
      return false;
    }
  }, []);

  const setFieldTouched = useCallback((field: string) => {
    setState((prev) => ({
      ...prev,
      touched: new Set([...prev.touched, field]),
    }));
  }, []);

  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: [],
      isValid: true,
    }));
  }, []);

  const getFieldError = useCallback((field: string): string | undefined => {
    return state.errors.find((error) => error.field === field)?.message;
  }, [state.errors]);

  const hasFieldError = useCallback((field: string): boolean => {
    return state.errors.some((error) => error.field === field);
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
    hasFieldError,
  };
}

export function useFormState<T extends Record<string, unknown>>(
  initialValues: T,
  validationSchema?: z.AnyZodObject,
) {
  const [values, setValues] = useState<T>(initialValues);
  const validation = useFormValidation();

  const setValue = useCallback((field: keyof T, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }));

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
    ...validation,
  };
}
