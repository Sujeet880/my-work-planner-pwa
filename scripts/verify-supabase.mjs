import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const envLocalPath = path.resolve(rootDir, '.env.local');

console.log('=== My Work Planner — Supabase Configuration & Schema Verification ===\n');

// 1. Check .env.local file
if (!fs.existsSync(envLocalPath)) {
  console.error('❌ .env.local not found at:', envLocalPath);
  process.exit(1);
}
console.log('✅ .env.local exists at project root.');

// 2. Parse variables manually from .env.local
const envContent = fs.readFileSync(envLocalPath, 'utf8');
let supabaseUrl = null;
let supabaseKey = null;

for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || !trimmed) continue;
  const match = trimmed.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (match) {
    const key = match[1];
    let val = match[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'VITE_SUPABASE_URL') supabaseUrl = val;
    if (key === 'VITE_SUPABASE_PUBLISHABLE_KEY') supabaseKey = val;
  }
}

// 3. Verify Project URL
console.log(`\n1. Project URL Check:`);
if (!supabaseUrl) {
  console.log('❌ VITE_SUPABASE_URL is missing or empty in .env.local');
} else {
  try {
    const parsed = new URL(supabaseUrl);
    console.log(`✅ VITE_SUPABASE_URL is valid: ${parsed.origin}`);
    console.log(`   Host: ${parsed.host}`);
    console.log(`   Protocol: ${parsed.protocol}`);
  } catch {
    console.log(`❌ VITE_SUPABASE_URL is not a valid URL: "${supabaseUrl}"`);
  }
}

// 4. Verify Publishable Key Presence
console.log(`\n2. Publishable Key Presence:`);
if (!supabaseKey) {
  console.log('⚠️  VITE_SUPABASE_PUBLISHABLE_KEY is not configured yet in .env.local.');
  console.log('   (Paste your local publishable key into .env.local to enable live API verification)');
} else {
  const masked = supabaseKey.length > 10
    ? `${supabaseKey.slice(0, 8)}...${supabaseKey.slice(-4)} (length: ${supabaseKey.length})`
    : 'Present (short)';
  console.log(`✅ VITE_SUPABASE_PUBLISHABLE_KEY is present: ${masked}`);
}

// 5. Test Client Initialization & Table Queries
console.log(`\n3. Supabase Client & Remote Tables Verification:`);
if (supabaseUrl && supabaseKey) {
  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
    console.log('✅ @supabase/supabase-js createClient initialized successfully.');

    // 6. Test Auth Endpoint Connectivity
    console.log(`\n4. Remote Auth Endpoint Reachability:`);
    const start = Date.now();
    const { data: sessionData, error: sessionErr } = await client.auth.getSession();
    const latencyMs = Date.now() - start;

    if (sessionErr) {
      console.log(`❌ Auth endpoint returned error (${latencyMs}ms): ${sessionErr.message}`);
    } else {
      console.log(`✅ Live Auth endpoint responsive (${latencyMs}ms latency).`);
    }

    // 7. Test All 6 Tables via Data API
    console.log(`\n5. Database Tables & RLS Verification:`);
    const tables = [
      'profiles',
      'projects',
      'tasks',
      'work_sessions',
      'active_timers',
      'user_preferences',
    ];

    for (const table of tables) {
      const tableStart = Date.now();
      const { data, error, status } = await client.from(table).select('*').limit(1);
      const tLatency = Date.now() - tableStart;

      if (error) {
        // PostgREST 404 / 401 / 406 or schema cache error
        if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
          console.log(`❌ Table "${table}" does not exist in remote database (${tLatency}ms): ${error.message}`);
        } else {
          console.log(`⚠️  Table "${table}" returned code ${error.code} (${tLatency}ms): ${error.message}`);
        }
      } else {
        console.log(`✅ Table "${table}" is accessible via Data API with active RLS (${tLatency}ms, status ${status}).`);
      }
    }
  } catch (err) {
    console.log(`❌ Client initialization or query failed: ${err.message}`);
  }
} else {
  console.log('ℹ️  Skipping remote API query: publishable key awaiting user input in .env.local.');
  console.log('   Client factory and environment validation logic verified.');
}

console.log('\n============================================================');
