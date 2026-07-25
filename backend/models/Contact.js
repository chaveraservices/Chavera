import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
    // Human-facing entry number (#1, #2, …). Mongo's _id is unique but is a
    // 24-char hex string nobody can read out over the phone; this is the ID
    // staff actually refer to. Assigned in ContactController.insert.
    entry_no: { type: Number, default: null, index: true },
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
    phone_2: { type: String, default: null },     // kept for back-compat; = phones[0]
    phones: { type: [String], default: [] },      // additional numbers beyond phone_1
    category: { type: String, default: null },
    // Client-requested classification fields
    customer_grade: { type: String, default: null },   // Low Potential | Potential | High Potential
    house_type: { type: String, default: null },       // Own | Rented
    purchase_type: { type: String, default: null },    // Finance | Cash
    products: { type: [String], default: [] },         // Cot, Mattresses, Sofa set, …
    contact_date: { type: Date, default: null },       // manually entered date (createdAt is the auto date)
    notes: { type: String, default: null },
    // Who created the entry. created_by_name is a snapshot so the entry still
    // shows an author even if that user is later renamed or removed.
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    created_by_name: { type: String, default: null }
}, {
    timestamps: true
});

// Indexes to support filtering and sorting at scale.
contactSchema.index({ full_name: 1 });
contactSchema.index({ state: 1, district: 1, village_town: 1 });
contactSchema.index({ category: 1 });
contactSchema.index({ customer_grade: 1 });
contactSchema.index({ phone_1: 1 });

export default mongoose.model('Contact', contactSchema);
