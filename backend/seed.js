import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from './models/User.js';

const SUPERADMIN = {
    name: 'Super Admin',
    email: 'dharmiksuthar0509@gmail.com',
    password: 'Admin@1234',
};

async function seed() {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chevera_db';

    console.log('Connecting to MongoDB…');
    await mongoose.connect(uri);
    console.log('Connected.\n');

    const hashedPassword = await bcrypt.hash(SUPERADMIN.password, 10);

    const existing = await User.findOne({ email: SUPERADMIN.email });

    if (existing) {
        // Directly update to avoid double-hashing from the pre-save hook
        await User.updateOne(
            { email: SUPERADMIN.email },
            { $set: { name: SUPERADMIN.name, password: hashedPassword } }
        );
        console.log('✔  Superadmin already existed — credentials reset.');
    } else {
        // Bypass pre-save hook by inserting with already-hashed password
        await User.collection.insertOne({
            name: SUPERADMIN.name,
            email: SUPERADMIN.email,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        console.log('✔  Superadmin created successfully.');
    }

    console.log(`\n    Email    : ${SUPERADMIN.email}`);
    console.log(`    Password : ${SUPERADMIN.password}`);

    await mongoose.disconnect();
    console.log('\nDone.');
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
