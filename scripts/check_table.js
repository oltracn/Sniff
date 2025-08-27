#!/usr/bin/env node
// Check database table structure
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

import { supabaseAdmin } from '../src/services/supabaseAdmin.js';

async function checkTableStructure() {
  console.log('Checking music_items table structure...');

  try {
    // First, create a test fetch_event
    const testEvent = {
      guest_id: 'test_structure_check',
      url: 'test',
      title: 'test',
      fetched_at: new Date().toISOString(),
      meta: { test: true }
    };

    const { data: eventData, error: eventError } = await supabaseAdmin.from('fetch_events').insert(testEvent).select();
    if (eventError) {
      console.error('Failed to create test event:', eventError);
      return;
    }

    const fetchId = eventData[0].id;
    console.log('Created test event with ID:', fetchId);

    // Now insert a test music_item
    const testRecord = {
      fetch_id: fetchId,
      guest_id: 'test_structure_check',
      song: 'test',
      artist: 'test',
      album: 'test',
      cover_url: 'test',
      spotify_url: 'test',
      meta: { test: true }
    };

    const { data: insertData, error: insertError } = await supabaseAdmin.from('music_items').insert(testRecord).select();
    if (insertError) {
      console.error('Insert test failed:', insertError);
    } else {
      console.log('Insert successful!');
      console.log('music_items table columns:', Object.keys(insertData[0]));
      console.log('Sample record:', JSON.stringify(insertData[0], null, 2));
    }

    // Clean up test records
    await supabaseAdmin.from('music_items').delete().eq('guest_id', 'test_structure_check');
    await supabaseAdmin.from('fetch_events').delete().eq('guest_id', 'test_structure_check');

  } catch (err) {
    console.error('Failed to check table structure:', err);
  }
}

checkTableStructure();
