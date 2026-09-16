#!/usr/bin/env node
// Uploads a prepped ambient track to the ambient-tracks Supabase bucket.
// Needs the service-role key (not the anon key) since this bypasses the
// app entirely — it's an admin action, never something the app itself does.
//
//   node scripts/upload-ambient-track.js "ready/Rain On Leaves Loop.mp3" "Rain On Leaves Loop.mp3"
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const [, , filePath, destName] = process.argv;
if (!filePath || !destName) {
  console.error('Usage: node scripts/upload-ambient-track.js <local file path> <destination filename>');
  process.exit(1);
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const buffer = fs.readFileSync(filePath);

supabase.storage
  .from('ambient-tracks')
  .upload(destName, buffer, { contentType: 'audio/mpeg', upsert: false })
  .then(({ data, error }) => {
    if (error) {
      console.error('UPLOAD_ERROR', error.message);
      process.exit(1);
    }
    console.log('UPLOAD_OK', data.path);
  });
