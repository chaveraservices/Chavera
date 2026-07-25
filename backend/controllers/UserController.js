import User from '../models/User.js';
import bcrypt from 'bcrypt';
import ApiError from '../utils/ApiError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'staff'];

export default class UserController {
    async changePassword(req, res, next) {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            throw new ApiError(400, 'Current and new password are required');
        }
        if (newPassword.length < 6) {
            throw new ApiError(400, 'New password must be at least 6 characters');
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new ApiError(400, 'Current password is incorrect');
        }

        // Assigning the plain password lets the User pre('save') hook hash it.
        user.password = newPassword;
        await user.save();

        res.locals.data = null;
        res.locals.message = 'Password changed successfully';
        next();
    }

    // Fresh profile for the logged-in user. Lets the client reconcile its
    // cached copy against the database, so a name changed in the DB (or a role
    // changed by an admin) shows up without forcing a logout/login.
    async me(req, res, next) {
        const user = await User.findById(req.user.id, 'name email role').lean();
        if (!user) throw new ApiError(404, 'User not found');
        res.locals.data = { id: user._id, name: user.name, email: user.email, role: user.role || 'admin' };
        res.locals.message = 'Profile fetched successfully';
        next();
    }

    // ---- User access management (admin only; routes enforce the role) ----

    async list(req, res, next) {
        const users = await User.find({}, 'name email role createdAt lastActivityAt').sort({ createdAt: 1 }).lean();
        res.locals.data = users.map(u => ({ ...u, role: u.role || 'admin' }));
        res.locals.message = 'Users fetched successfully';
        next();
    }

    async create(req, res, next) {
        let { name, email, password, role } = req.body || {};
        if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
            throw new ApiError(400, 'Name, email and password are required');
        }
        name = name.trim();
        email = email.trim().toLowerCase();

        if (!name || !email || !password) throw new ApiError(400, 'Name, email and password are required');
        if (!EMAIL_RE.test(email)) throw new ApiError(400, 'Please provide a valid email address');
        if (password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
        if (!ROLES.includes(role)) throw new ApiError(400, 'Role must be admin or staff');

        if (await User.findOne({ email })) throw new ApiError(409, 'A user with that email already exists');

        const user = new User({ name, email, password, role });
        await user.save();

        res.locals.data = { id: user._id, name: user.name, email: user.email, role: user.role };
        res.locals.message = 'User created successfully';
        next();
    }

    async updateRole(req, res, next) {
        const { id, role } = req.body || {};
        if (!id) throw new ApiError(400, 'User id is required');
        if (!ROLES.includes(role)) throw new ApiError(400, 'Role must be admin or staff');

        const user = await User.findById(id);
        if (!user) throw new ApiError(404, 'User not found');

        // Demoting yourself would immediately revoke the access you are using.
        if (String(user._id) === String(req.user.id) && role !== 'admin') {
            throw new ApiError(400, 'You cannot change your own role. Ask another admin to do it.');
        }
        // Never leave the system without an admin — nobody could get back in.
        if ((user.role || 'admin') === 'admin' && role !== 'admin') {
            const admins = await User.countDocuments({ $or: [{ role: 'admin' }, { role: { $exists: false } }, { role: null }] });
            if (admins <= 1) throw new ApiError(400, 'This is the only admin. Promote someone else first.');
        }

        user.role = role;
        await user.save();

        res.locals.data = { id: user._id, role: user.role };
        res.locals.message = 'Role updated successfully';
        next();
    }

    async remove(req, res, next) {
        const { id } = req.body || {};
        if (!id) throw new ApiError(400, 'User id is required');
        if (String(id) === String(req.user.id)) {
            throw new ApiError(400, 'You cannot delete your own account.');
        }

        const user = await User.findById(id);
        if (!user) throw new ApiError(404, 'User not found');

        if ((user.role || 'admin') === 'admin') {
            const admins = await User.countDocuments({ $or: [{ role: 'admin' }, { role: { $exists: false } }, { role: null }] });
            if (admins <= 1) throw new ApiError(400, 'This is the only admin and cannot be deleted.');
        }

        await User.deleteOne({ _id: id });

        res.locals.data = null;
        res.locals.message = 'User removed successfully';
        next();
    }

    // Admin-set password, for when a staff member is locked out. Distinct from
    // changePassword, which requires knowing the current one.
    async resetPassword(req, res, next) {
        const { id, newPassword } = req.body || {};
        if (!id || typeof newPassword !== 'string') throw new ApiError(400, 'User id and new password are required');
        if (newPassword.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');

        const user = await User.findById(id);
        if (!user) throw new ApiError(404, 'User not found');

        user.password = newPassword;   // pre('save') hashes it
        await user.save();

        res.locals.data = null;
        res.locals.message = 'Password reset successfully';
        next();
    }
}
