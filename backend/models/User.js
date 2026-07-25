import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    // admin: full access. staff: create/edit entries + print, but no deleting,
    // bulk import, or settings. Existing users predate this field and default
    // to admin so nobody is locked out of their own system by the upgrade.
    role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
    keepAliveEnabled: { type: Boolean, default: false },
    // Last time this user made an authenticated request. Updated (throttled) by
    // the auth middleware so admins can see who is still active.
    lastActivityAt: { type: Date, default: null }
}, {
    timestamps: true
});

userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

export default mongoose.model('User', userSchema);
