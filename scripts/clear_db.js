#!/usr/bin/env node
// Clear fetch_events and music_items tables using the server-side supabase client.
// WARNING: this permanently deletes data. Require --confirm to actually run.
// Usage (PowerShell):
// From project root: node Sniff/scripts/clear_db.js --confirm

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env located in the Sniff directory (one level above this scripts folder)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

import { supabaseAdmin } from '../src/services/supabaseAdmin.js';

async function main() {
  console.log(`Using env from: ${envPath}`);
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET'}`);
  console.log(`SUPABASE_SECRET_KEY: ${process.env.SUPABASE_SECRET_KEY ? process.env.SUPABASE_SECRET_KEY.substring(0, 10) + '...' : 'NOT SET'}`);

  const ok = process.argv.includes('--confirm') || process.argv.includes('-y');
  if (!ok) {
    console.log('This script will DELETE ALL rows in public.music_items and public.fetch_events.');
    console.log('Run with --confirm to proceed: node Sniff/scripts/clear_db.js --confirm');
    process.exit(0);
  }

  try {
    // Test connection
    const { error: testErr } = await supabaseAdmin.from('music_items').select('*').limit(0);
    if (testErr) {
      console.error('Connection test failed:', testErr);
      throw testErr;
    }
    console.log('Connection OK, table exists.');

    // Delete music_items first because it references fetch_events
    const { data: deletedItems, error: delItemsErr } = await supabaseAdmin.from('music_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delItemsErr) throw delItemsErr;
    console.log(`Deleted ${Array.isArray(deletedItems) ? deletedItems.length : 0} rows from music_items.`);

    const { data: deletedEvents, error: delEventsErr } = await supabaseAdmin.from('fetch_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delEventsErr) throw delEventsErr;
    console.log(`Deleted ${Array.isArray(deletedEvents) ? deletedEvents.length : 0} rows from fetch_events.`);

    console.log('Database cleared successfully.');
  } catch (err) {
    console.error('Failed to clear DB:', err && err.message ? err.message : err);
    if (err.stack) console.error('Stack:', err.stack);
    process.exit(1);
  }
}

main();
