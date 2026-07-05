import User from '../models/User.js';
import bcrypt from 'bcrypt';
import ApiError from '../utils/ApiError.js';

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
}
