/* ==========================================================================
   Tenn95 — Airtable → data/plates.json sync
   Run this LOCALLY whenever you've added/edited plates in Airtable, then
   commit + push the updated data/plates.json AND assets/img/plates/.
   Nothing about this script runs automatically, and no Airtable
   credentials ever touch GitHub.

   IMPORTANT: Airtable's API attachment URLs expire ~2 hours after being
   fetched (this is documented Airtable behavior, not a bug here). This
   script downloads each photo to assets/img/plates/ and points the site
   at that local file instead of the Airtable URL — that's the only way
   photos keep working after sync. Don't "simplify" this back to storing
   the raw Airtable URL; it will look fine for two hours, then break.

   Setup:
     1. cd scripts && npm install
     2. Copy .env.example to .env and fill in your values (see below)
     3. node sync-airtable.js
     4. git add ../data/plates.json ../assets/img/plates && git commit -m "Sync plates" && git push

   Getting your credentials:
     - AIRTABLE_TOKEN: airtable.com/create/tokens — create a Personal
       Access Token with "data.records:read" scope, limited to this base.
     - AIRTABLE_BASE_ID: found in Airtable's API docs for your base
       (starts with "app...").
     - AIRTABLE_TABLE_NAME: the exact table name, e.g. "Plates".

   IMPORTANT — field name mapping below:
   These map YOUR Airtable field names (left) to the site's data shape
   (right). The four field names come from what you told me the base
   uses: Year, County Number, County Name, Colors, Type. PHOTO_FIELD is
   a guess ("Photo") — confirm your actual attachment field name and
   fix it below if it's different, or the sync will silently produce
   plates with no photo.
   ========================================================================== */

require('dotenv').config();

const TOKEN = process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Plates';

// ---- FIELD MAPPING — confirm these match your base exactly ----
const FIELD_MAP = {
  year: 'Year',
  countyNumber: 'County Prefix',
  countyName: 'County',
  colors: 'Plate Color',
  fontColor: 'Font Color',
  type: 'Type',
  photo: 'Photo',        // TODO: confirm this is your attachment field's real name
  serial: 'Serial',      // TODO: confirm — used for search; remove this line if you don't have one
};
// -----------------------------------------------------------------

const path = require('path');
const fs = require('fs');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'plates.json');
const PHOTO_DIR = path.join(__dirname, '..', 'assets', 'img', 'plates');
const PHOTO_WEB_PATH = 'assets/img/plates'; // how it's referenced from the HTML pages

if (!TOKEN || !BASE_ID) {
  console.error('Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

fs.mkdirSync(PHOTO_DIR, { recursive: true });

async function fetchAllRecords(){
  const records = [];
  let offset;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;

    if (offset) await new Promise(r => setTimeout(r, 250)); // stay well under the 5 req/sec cap
  } while (offset);

  return records;
}

// Downloads an Airtable attachment to assets/img/plates/ before its URL
// expires, and returns the local web path to use in plates.json. Skips
// the download if we already have a file for this attachment id (fast
// re-syncs, no re-downloading photos that haven't changed).
async function downloadPhoto(attachment){
  if (!attachment) return null;
  const ext = (attachment.filename || '').split('.').pop() || 'jpg';
  const localFilename = `${attachment.id}.${ext}`;
  const localPath = path.join(PHOTO_DIR, localFilename);

  if (!fs.existsSync(localPath)) {
    const res = await fetch(attachment.url);
    if (!res.ok) throw new Error(`Failed to download photo ${attachment.id}: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
  }

  return `${PHOTO_WEB_PATH}/${localFilename}`;
}

async function transformRecord(record){
  const f = record.fields;
  const photoField = f[FIELD_MAP.photo];
  const attachment = Array.isArray(photoField) && photoField.length ? photoField[0] : null;
  const photoUrl = await downloadPhoto(attachment);

  return {
    id: record.id,
    year: f[FIELD_MAP.year] || null,
    countyNumber: f[FIELD_MAP.countyNumber] || null,
    countyName: f[FIELD_MAP.countyName] || null,
    colors: f[FIELD_MAP.colors] || [],
    fontColor: f[FIELD_MAP.fontColor] || null,
    type: f[FIELD_MAP.type] || null,
    serial: f[FIELD_MAP.serial] || null,
    photoUrl,
    dateAdded: record.createdTime,
  };
}

async function main(){
  console.log(`Fetching records from base ${BASE_ID}, table "${TABLE_NAME}"...`);
  const records = await fetchAllRecords();
  console.log(`Fetched ${records.length} record(s). Downloading any new photos...`);

  const plates = [];
  for (const record of records) {
    plates.push(await transformRecord(record));
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(plates, null, 2));
  console.log(`Wrote ${plates.length} plate(s) to ${OUTPUT_PATH}`);
  console.log('Now commit and push data/plates.json AND assets/img/plates/ to publish the update.');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
