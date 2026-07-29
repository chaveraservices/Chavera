import mongoose from 'mongoose';

// The catalogue of products offered, previously hardcoded in the frontend.
// Contacts store their chosen products as plain strings (products: [String]),
// so removing a product here is a SOFT delete (active: false) — the historical
// strings on existing contacts stay valid, the product just stops being
// offered on new entries.
const productSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },
    // Controls the order products appear in the form / filter.
    sort_order: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.index({ active: 1, sort_order: 1 });

export default mongoose.model('Product', productSchema);
