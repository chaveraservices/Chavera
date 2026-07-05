import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
    honorific: { type: String, default: null },
    full_name: { type: String, required: true },
    relation: { type: String, default: null },
    business_name: { type: String, default: null },
    age: { type: String, default: null },
    ppr: { type: String, default: null },
    toq: { type: String, default: null },
    instagram_id: { type: String, default: null },
    product_name: { type: String, default: null },
    customer_occupation: { type: String, default: null },
    door_flat_no: { type: String, default: null },
    street: { type: String, default: null },
    landmark: { type: String, default: null },
    village_town: { type: String, required: true },
    mandal: { type: String, default: null },
    district: { type: String, default: null },
    state: { type: String, default: null },
    pincode: { type: String, default: null },
    phone_1: { type: String, required: true },
    phone_2: { type: String, default: null },
    category: { type: String, default: null },
    notes: { type: String, default: null }
}, {
    timestamps: true
});

// Indexes to support filtering and sorting at scale.
contactSchema.index({ full_name: 1 });
contactSchema.index({ state: 1, district: 1, village_town: 1 });
contactSchema.index({ category: 1 });
contactSchema.index({ phone_1: 1 });

export default mongoose.model('Contact', contactSchema);
