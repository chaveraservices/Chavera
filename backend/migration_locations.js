import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function migrate() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chevera_db';
    console.log('Connecting to MongoDB…');
    await mongoose.connect(uri);
    console.log('Connected.');

    const db = mongoose.connection.db;
    const locationsColl = db.collection('locations');

    const locations = await locationsColl.find({}).toArray();

    for (const loc of locations) {
        // Check if it's using the old format (array of strings)
        if (loc.districts && loc.districts.length > 0 && typeof loc.districts[0] === 'string') {
            const newDistricts = loc.districts.map(dName => ({
                name: dName,
                cities: []
            }));

            await locationsColl.updateOne(
                { _id: loc._id },
                { $set: { districts: newDistricts } }
            );
            console.log(`Migrated state: ${loc.state}`);
        }
    }

    console.log('Migration complete.');
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
