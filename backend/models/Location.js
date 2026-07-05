import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
    state: { type: String, required: true, unique: true, trim: true },
    districts: [{
        name: { type: String, required: true, trim: true },
        cities: [{ type: String, trim: true }]
    }]
}, {
    timestamps: true
});

export default mongoose.model('Location', locationSchema);
    