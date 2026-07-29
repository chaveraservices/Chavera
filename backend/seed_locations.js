// seed_locations.js — Populate the Location collection with Indian
// States → Districts → Cities so the form's cascading dropdowns are pre-filled.
//
// Data: backend/data/india-locations.json  (derived from the India Post pincode
// directory; ~35 states, ~594 districts, ~3,100 cities/towns).
//
// Run against whichever DB the MONGO_URI points at:
//   node seed_locations.js          (uses .env MONGO_URI)
//
// Idempotent & safe to re-run:
//   - Creates states/districts/cities that don't exist yet.
//   - NEVER deletes anything; merges into what's already there.
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Location from './models/Location.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function seedLocations() {
    // Priority: CLI arg (node seed_locations.js "<uri>") > MONGO_URI from .env.
    // Passing a URI arg lets you target UAT/prod without editing .env.
    const uri = process.argv[2] || process.env.MONGO_URI;
    if (!uri) {
        console.error('FATAL: no MongoDB URI. Pass one as an argument or set MONGO_URI in .env.');
        console.error('Example: node seed_locations.js "mongodb+srv://…/chavera_uat?…"');
        process.exit(1);
    }

    const dataset = JSON.parse(
        readFileSync(join(__dirname, 'data', 'india-locations.json'), 'utf-8')
    );

    console.log('Connecting to MongoDB…');
    await mongoose.connect(uri);
    console.log(`Connected to: ${mongoose.connection.name}\n`);

    let createdStates = 0, addedDistricts = 0, addedCities = 0;

    for (const { state, districts } of dataset) {
        const stateName = state.trim();
        const existing = await Location.findOne({ state: stateName });

        if (!existing) {
            await new Location({ state: stateName, districts }).save();
            createdStates++;
            const cityCount = districts.reduce((s, d) => s + d.cities.length, 0);
            console.log(`+ Created "${stateName}" (${districts.length} districts, ${cityCount} cities)`);
            continue;
        }

        // Merge into existing state: add missing districts, and missing cities within districts.
        let changed = false;
        const districtByName = new Map(existing.districts.map(d => [d.name.toLowerCase(), d]));

        for (const d of districts) {
            const key = d.name.toLowerCase();
            const target = districtByName.get(key);
            if (!target) {
                existing.districts.push({ name: d.name, cities: d.cities });
                addedDistricts++;
                addedCities += d.cities.length;
                changed = true;
            } else {
                const have = new Set((target.cities || []).map(c => c.toLowerCase()));
                for (const c of d.cities) {
                    if (!have.has(c.toLowerCase())) { target.cities.push(c); addedCities++; changed = true; }
                }
                if (changed) target.cities.sort((a, b) => a.localeCompare(b));
            }
        }

        if (changed) {
            existing.districts.sort((a, b) => a.name.localeCompare(b.name));
            await existing.save();
            console.log(`~ Updated "${stateName}"`);
        }
    }

    console.log(`\nDone. Created ${createdStates} states, added ${addedDistricts} districts, ${addedCities} cities.`);
    await mongoose.disconnect();
}

seedLocations().catch(err => {
    console.error('Location seed failed:', err.message);
    process.exit(1);
});
