import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chevera_db';

async function run() {
    await mongoose.connect(uri);
    const stats = await mongoose.connection.db.stats();
    console.log(JSON.stringify(stats, null, 2));
    await mongoose.disconnect();
}
run();
