# 🗄️ Actual Database Schema Reference
*Based on real Supabase database inspection - January 2025*

## 📋 **Core Tables - Actual Schema**

### **1. households**
```sql
CREATE TABLE households (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  plan TEXT DEFAULT 'free',
  game_mode TEXT DEFAULT 'default',
  created_by TEXT
);
```

### **2. users**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY, -- Clerk user ID
  instance_id UUID,
  email TEXT,
  aud CHARACTER VARYING,
  role TEXT DEFAULT 'member',
  xp INTEGER DEFAULT 0
  -- Note: This table has a complex Clerk integration schema
  -- Missing: household_id, onboarding_completed, created_at, updated_at
);
```

### **3. household_members**
```sql
-- Table exists but schema not fully visible in screenshots
-- Likely has: user_id, household_id, role, created_at
```

## 🛒 **Shopping System - Actual Schema**

### **4. shopping_lists**
```sql
CREATE TABLE shopping_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID,
  title TEXT NOT NULL, -- Uses 'title', not 'name'
  created_by TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT timezone('utc'::text, now())
  -- Missing: description, is_completed, ai_suggestions_count, ai_confidence, updated_at
);
```

### **5. shopping_items**
```sql
CREATE TABLE shopping_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID,
  name TEXT NOT NULL,
  quantity TEXT, -- Note: TEXT, not INTEGER
  is_complete BOOLEAN DEFAULT false,
  completed_by TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMP WITHOUT TIME ZONE,
  completed BOOLEAN DEFAULT false, -- Note: Has both 'is_complete' AND 'completed'
  updated_at TIMESTAMPTZ DEFAULT now()
  -- Missing: category, ai_suggested, ai_confidence
);
```

## 🍳 **Recipe System - Actual Schema**

### **6. recipes**
```sql
CREATE TABLE recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL,
  title TEXT NOT NULL, -- Uses 'title', not 'name'
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  instructions TEXT[],
  created_by TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  prep_time INTEGER NOT NULL DEFAULT 0,
  cook_time INTEGER NOT NULL DEFAULT 0,
  servings INTEGER NOT NULL DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  image_url TEXT
);
```

## 🧹 **Chore System - Actual Schema**

### **7. chores**
```sql
CREATE TABLE chores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to TEXT,
  due_at TIMESTAMP WITHOUT TIME ZONE,
  recurrence TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  ai_difficulty_rating INTEGER DEFAULT 50,
  ai_estimated_duration INTEGER DEFAULT 30,
  ai_preferred_time TEXT DEFAULT 'anytime',
  ai_energy_level TEXT DEFAULT 'medium',
  ai_skill_requirements TEXT[] DEFAULT '{}',
  ai_confidence INTEGER DEFAULT 15,
  ai_suggested BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  category TEXT DEFAULT 'general',
  rrule TEXT, -- Recurrence rule
  dtstart TIMESTAMPTZ, -- Recurrence start date
  undated_at TIMESTAMPTZ DEFAULT now()
  -- Missing: points, frequency (as separate columns)
);
```

## 🍽️ **Meal Planning - Actual Schema**

### **8. meal_plans**
```sql
CREATE TABLE meal_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL,
  week_start_date DATE NOT NULL,
  meals JSONB NOT NULL DEFAULT '{}'
  -- Missing: created_at, updated_at
);
```

## 🔧 **Key Schema Differences from Codebase**

### **Column Name Differences:**
1. **shopping_lists** uses `title` (not `name`)
2. **recipes** uses `title` (not `name`)
3. **shopping_items** has both `is_complete` AND `completed`

### **Missing Columns in Actual DB:**
1. **households**: No `updated_at`
2. **users**: Missing `household_id`, `onboarding_completed`, `created_at`, `updated_at`
3. **shopping_lists**: Missing `description`, `is_completed`, `ai_*` columns
4. **shopping_items**: Missing `category`, `ai_*` columns
5. **chores**: Missing `points`, `frequency` (as separate columns)
6. **meal_plans**: Missing `created_at`, `updated_at`

### **Additional Columns in Actual DB:**
1. **households**: `plan`, `game_mode`, `created_by`
2. **chores**: AI-related columns, `rrule`, `dtstart`, `priority`, `status`
3. **recipes**: `tags`, `image_url`
4. **shopping_items**: `completed` (duplicate of `is_complete`)

## 📝 **Notes for Seed Scripts**

- Use `title` for shopping_lists and recipes
- Use `is_complete` for shopping_items (avoid `completed` to prevent confusion)
- Include `plan`, `game_mode`, `created_by` for households
- Include AI-related columns for chores
- Include `tags`, `image_url` for recipes
- Be aware that `users` table has complex Clerk integration
- Many tables are missing `updated_at` columns

## 🚨 **Important Warnings**

1. **Schema Mismatch**: Your actual database schema differs significantly from the migration files in your codebase
2. **Missing Columns**: Many expected columns don't exist in the actual database
3. **Duplicate Columns**: `shopping_items` has both `is_complete` and `completed`
4. **Clerk Integration**: The `users` table has a complex Clerk-specific schema

## 🎯 **Recommendations**

1. **Update Migration Files**: Align your codebase schema files with the actual database
2. **Fix Duplicate Columns**: Consider removing the duplicate `completed` column from `shopping_items`
3. **Add Missing Columns**: Consider adding missing columns like `updated_at` where needed
4. **Document AI Features**: The AI-related columns in chores suggest advanced features not documented in codebase
