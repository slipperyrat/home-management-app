import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      {
        error: 'Missing environment variables',
        hasUrl: Boolean(supabaseUrl),
        hasKey: Boolean(supabaseKey),
      },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test if we can connect to the database
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          error: 'Database connection failed',
          details: error,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: 'Database connection successful',
      tableExists: Boolean(data?.length),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Database test failed',
        details: errorMessage,
      },
      { status: 500 },
    );
  }
} 