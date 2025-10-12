import sanitizeHtml from 'sanitize-html';

/**
 * Configuration for plain text sanitization - strips all HTML
 */
const textConfig: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  allowedSchemes: [],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [],
  allowProtocolRelative: false,
  enforceHtmlBoundary: false,
};

/**
 * Configuration for rich text sanitization - allows limited formatting
 */
const richConfig: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'code', 'pre',
    'ul', 'ol', 'li', 'a'
  ],
  allowedAttributes: {
    'a': ['href'],
    // All other tags have no allowed attributes
    '*': []
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    'a': ['http', 'https', 'mailto']
  },
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  // Remove any attributes starting with 'on' (event handlers)
  transformTags: {
    'a': (tagName, attribs) => {
      // Ensure href is safe and remove any event handlers
      const cleanAttribs: { [key: string]: string } = {};
      if (attribs.href && typeof attribs.href === 'string') {
        cleanAttribs.href = attribs.href;
      }
      return {
        tagName,
        attribs: cleanAttribs
      };
    }
  },
  // Explicitly disallow all event handler attributes
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: false,
};

/**
 * Sanitizes a string by removing all HTML tags and dangerous content
 * @param str - The string to sanitize
 * @returns A plain text string with all HTML stripped
 */
export function sanitizeText(str: string | null | undefined): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  return sanitizeHtml(str.trim(), textConfig).trim();
}

/**
 * Sanitizes a string while preserving safe HTML formatting
 * @param str - The string to sanitize
 * @returns A string with safe HTML formatting preserved
 */
export function sanitizeRich(str: string | null | undefined): string {
  if (typeof str !== 'string') {
    return '';
  }
  
  return sanitizeHtml(str.trim(), richConfig).trim();
}

/**
 * Policy configuration for deep sanitization
 */
export interface SanitizePolicy {
  [key: string]: 'text' | 'rich' | 'skip';
}

/**
 * Default policy - sanitize all strings as plain text
 */
const defaultPolicy: SanitizePolicy = {};

/**
 * Recursively sanitizes all string values in an object or array
 * @param value - The value to sanitize (object, array, or primitive)
 * @param policy - Optional policy object defining per-key sanitization rules
 * @returns The sanitized value with all strings cleaned
 */
export function sanitizeDeep<T>(
  value: T, 
  policy: SanitizePolicy = defaultPolicy
): T {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  if (typeof value === 'string') {
    return sanitizeText(value) as T;
  }
  
  if (typeof value !== 'object' || value instanceof Date) {
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeDeep(item, policy)) as T;
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  
  for (const [key, val] of Object.entries(value)) {
    const keyPolicy = policy[key] || 'text';
    
    if (keyPolicy === 'skip') {
      result[key] = val;
    } else if (typeof val === 'string') {
      if (keyPolicy === 'rich') {
        result[key] = sanitizeRich(val);
      } else {
        result[key] = sanitizeText(val);
      }
    } else {
      result[key] = sanitizeDeep(val, policy);
    }
  }

  return result as T;
}

/**
 * Utility function to create a sanitization policy
 * @param policies - Object mapping keys to sanitization types
 * @returns A sanitization policy object
 */
export function createSanitizePolicy(policies: {
  [key: string]: 'text' | 'rich' | 'skip';
}): SanitizePolicy {
  return policies;
}

/**
 * Common sanitization policies for different data types
 */
export const commonPolicies = {
  // For user profiles - allow rich text in bio/description
  userProfile: createSanitizePolicy({
    name: 'text',
    email: 'text',
    bio: 'rich',
    description: 'rich',
    id: 'skip',
    created_at: 'skip',
    updated_at: 'skip'
  }),

  // For recipes - allow rich text in instructions/description
  recipe: createSanitizePolicy({
    title: 'text',
    description: 'rich',
    instructions: 'rich',
    id: 'skip',
    created_at: 'skip',
    updated_at: 'skip',
    prep_time: 'skip',
    cook_time: 'skip',
    servings: 'skip'
  }),

  // For planner items - allow rich text in description
  plannerItem: createSanitizePolicy({
    title: 'text',
    description: 'rich',
    category: 'text',
    priority: 'text',
    status: 'text',
    id: 'skip',
    created_at: 'skip',
    updated_at: 'skip',
    due_date: 'skip'
  }),

  // For shopping lists - plain text only
  shoppingList: createSanitizePolicy({
    title: 'text',
    name: 'text',
    quantity: 'text',
    id: 'skip',
    created_at: 'skip',
    updated_at: 'skip',
    completed: 'skip'
  })
};
