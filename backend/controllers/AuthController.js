import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import ApiError from '../utils/ApiError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default class AuthController {
    async register(req, res, next) {
        console.log('--- ENTERED REGISTER ---');
        let { name, email, password } = req.body;
        if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
            throw new ApiError(400, 'Invalid payload format');
        }

        if (!name.trim() || !email.trim() || !password) {
            throw new ApiError(400, 'All fields are required');
        }

        name = name.trim();
        email = email.trim().toLowerCase();

        if (!EMAIL_RE.test(email)) {
            throw new ApiError(400, 'Please provide a valid email address');
        }
        if (password.length < 6) {
            throw new ApiError(400, 'Password must be at least 6 characters');
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ApiError(409, 'User already exists');
        }

        const newUser = new User({ name, email, password });
        await newUser.save();

        res.locals.data = null;
        res.locals.message = 'User registered successfully';
        next();
    }

    async login(req, res, next) {
        let { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string') {
            throw new ApiError(400, 'Invalid payload format');
        }
        
        if (!email.trim() || !password) {
            throw new ApiError(400, 'Email and password are required');
        }

        email = email.trim().toLowerCase();

        const user = await User.findOne({ email });
        if (!user) {
            throw new ApiError(401, 'Invalid credentials');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new ApiError(401, 'Invalid credentials');
        }

        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.locals.data = { token, user: { id: user._id, name: user.name, email: user.email } };
        res.locals.message = 'Login successful';
        next();
    }
}
