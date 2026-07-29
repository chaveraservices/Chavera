import Product from '../models/Product.js';
import ApiError from '../utils/ApiError.js';

export default class ProductController {
    // Active products for the form / filter (any signed-in user).
    // `includeInactive: true` (admin management panel) returns everything.
    async list(req, res, next) {
        const { includeInactive } = req.body || {};
        const query = includeInactive ? {} : { active: true };
        const products = await Product.find(query)
            .sort({ sort_order: 1, name: 1 })
            .lean();
        res.locals.data = products.map(p => ({ id: p._id, name: p.name, active: p.active, sort_order: p.sort_order }));
        res.locals.message = 'Products fetched successfully';
        next();
    }

    async create(req, res, next) {
        let { name } = req.body || {};
        name = typeof name === 'string' ? name.trim() : '';
        if (!name) throw new ApiError(400, 'Product name is required');
        if (name.length > 60) throw new ApiError(400, 'Product name cannot exceed 60 characters');

        // Case-insensitive duplicate guard. If a soft-deleted product with the
        // same name exists, reactivate it rather than erroring — the common case
        // is re-adding something removed by mistake.
        const existing = await Product.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
        if (existing) {
            if (existing.active) throw new ApiError(409, 'That product already exists');
            existing.active = true;
            await existing.save();
            res.locals.data = { id: existing._id, name: existing.name, active: true };
            res.locals.message = 'Product restored';
            return next();
        }

        const max = await Product.findOne().sort({ sort_order: -1 }).select('sort_order').lean();
        const product = await Product.create({ name, sort_order: (max?.sort_order || 0) + 1 });
        res.locals.data = { id: product._id, name: product.name, active: product.active };
        res.locals.message = 'Product added';
        next();
    }

    async update(req, res, next) {
        const { id, name, active } = req.body || {};
        if (!id) throw new ApiError(400, 'Product id is required');
        const product = await Product.findById(id);
        if (!product) throw new ApiError(404, 'Product not found');

        if (typeof name === 'string' && name.trim()) {
            const trimmed = name.trim();
            if (trimmed.length > 60) throw new ApiError(400, 'Product name cannot exceed 60 characters');
            const clash = await Product.findOne({
                _id: { $ne: id },
                name: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
            });
            if (clash) throw new ApiError(409, 'Another product already has that name');
            product.name = trimmed;
        }
        if (typeof active === 'boolean') product.active = active;

        await product.save();
        res.locals.data = { id: product._id, name: product.name, active: product.active };
        res.locals.message = 'Product updated';
        next();
    }

    // Soft delete — deactivate rather than remove, so contacts that already
    // list this product keep a valid value.
    async remove(req, res, next) {
        const { id } = req.body || {};
        if (!id) throw new ApiError(400, 'Product id is required');
        const product = await Product.findByIdAndUpdate(id, { active: false });
        if (!product) throw new ApiError(404, 'Product not found');
        res.locals.data = null;
        res.locals.message = 'Product removed';
        next();
    }
}
