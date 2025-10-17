import { ShoppingCart, Utensils, Clock, Brain, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AIRequestType } from './types/dashboard';

export const REQUEST_TYPE_ICON: Record<AIRequestType, ReactNode> = {
  shopping_suggestions: <ShoppingCart className="h-4 w-4" />,
  meal_planning: <Utensils className="h-4 w-4" />,
  chore_assignment: <Clock className="h-4 w-4" />,
  email_processing: <Brain className="h-4 w-4" />,
};

export const DEFAULT_REQUEST_ICON: ReactNode = <Zap className="h-4 w-4" />;
