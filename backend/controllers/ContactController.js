import Contact from '../models/Contact.js';
import ApiError from '../utils/ApiError.js';

const REQUIRED_MSG = 'Missing required fields: full_name, village_town, or phone_1';

// Escape user input before using it inside a RegExp.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default class ContactController {
    // Paginated + filtered list.
    // Body: { page, pageSize, search, state, district, city, category, all }
    async getAll(req, res, next) {
        const { search, state, district, city, category, relation, customer_grade, house_type, purchase_type, product, all } = req.body || {};

        const query = {};
        if (state) query.state = String(state);
        if (district) query.district = String(district);
        if (city) query.village_town = String(city);
        if (category) query.category = String(category);
        if (relation) query.relation = String(relation);
        if (customer_grade) query.customer_grade = String(customer_grade);
        if (house_type) query.house_type = String(house_type);
        if (purchase_type) query.purchase_type = String(purchase_type);
        if (product) query.products = String(product); // array field: matches contacts whose products include this

        if (search && typeof search === 'string' && search.trim()) {
            const re = new RegExp(escapeRegex(search.trim()), 'i');
            query.$or = [
                { full_name: re },
                { phone_1: re },
                { phone_2: re },
                { business_name: re },
                { village_town: re },
                { district: re },
            ];
        }

        const total = await Contact.countDocuments(query);

        // `all: true` (used by export) returns the full matching set without paging.
        if (all) {
            const items = await Contact.find(query).collation({ locale: 'en' }).sort({ full_name: 1 });
            res.locals.data = { items, total, page: 1, pageSize: total };
            res.locals.message = 'Contacts fetched successfully';
            return next();
        }

        const page = Math.max(1, parseInt(req.body?.page, 10) || 1);
        const pageSize = Math.min(200, Math.max(1, parseInt(req.body?.pageSize, 10) || 25));

        const items = await Contact.find(query)
            .collation({ locale: 'en' })
            .sort({ full_name: 1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize);

        res.locals.data = { items, total, page, pageSize };
        res.locals.message = 'Contacts fetched successfully';
        next();
    }

    // Distinct values for every filter dropdown.
    async getFilterOptions(req, res, next) {
        const nonEmpty = (field) => Contact.distinct(field, { [field]: { $nin: [null, ''] } });
        const [tuples, categories, relations, grades, houseTypes, purchaseTypes, products] = await Promise.all([
            Contact.aggregate([
                { $group: { _id: { state: '$state', district: '$district', city: '$village_town' } } },
                { $project: { _id: 0, state: '$_id.state', district: '$_id.district', city: '$_id.city' } },
            ]),
            nonEmpty('category'),
            nonEmpty('relation'),
            nonEmpty('customer_grade'),
            nonEmpty('house_type'),
            nonEmpty('purchase_type'),
            Contact.distinct('products', { products: { $nin: [null, ''] } }),
        ]);

        const sorted = (a) => a.filter(Boolean).sort((x, y) => x.localeCompare(y));
        res.locals.data = {
            tuples,
            categories: sorted(categories),
            relations: sorted(relations),
            grades: sorted(grades),
            houseTypes: sorted(houseTypes),
            purchaseTypes: sorted(purchaseTypes),
            products: sorted(products),
        };
        res.locals.message = 'Filter options fetched successfully';
        next();
    }

    // Distinct village/town values already entered — powers the town autocomplete
    // so the app "learns" the small places a user actually works in.
    async getTownSuggestions(req, res, next) {
        const { state, district } = req.body || {};
        const query = { village_town: { $nin: [null, ''] } };
        if (state) query.state = String(state);
        if (district) query.district = String(district);

        const towns = await Contact.distinct('village_town', query);
        res.locals.data = towns.filter(Boolean).sort((a, b) => a.localeCompare(b));
        res.locals.message = 'Town suggestions fetched successfully';
        next();
    }

    async getById(req, res, next) {
        const { id } = req.body;
        if (!id) throw new ApiError(400, 'Contact ID is required');

        const contact = await Contact.findById(id);
        if (!contact) throw new ApiError(404, 'Contact not found');

        res.locals.data = contact;
        res.locals.message = 'Contact fetched successfully';
        next();
    }

    async insert(req, res, next) {
        let { honorific, full_name, relation, business_name, age, ppr, toq, instagram_id, product_name, customer_occupation, door_flat_no, street, landmark, village_town, mandal, district, state, pincode, phone_1, phone_2, category, customer_grade, house_type, purchase_type, products, contact_date, notes } = req.body;

        // Trim required string fields before validation
        full_name = (full_name || '').trim();
        village_town = (village_town || '').trim();
        phone_1 = (phone_1 || '').trim();

        if (!full_name || !village_town || !phone_1) {
            throw new ApiError(400, REQUIRED_MSG);
        }

        // Server-side phone format validation — 10 digits only
        if (!/^\d{10}$/.test(phone_1)) {
            throw new ApiError(400, 'phone_1 must be exactly 10 digits');
        }
        if (phone_2 && !/^\d{10}$/.test(phone_2.toString().trim())) {
            throw new ApiError(400, 'phone_2 must be exactly 10 digits');
        }

        const newContact = new Contact({
            honorific, full_name, relation, business_name, age, ppr, toq, instagram_id, product_name, customer_occupation, door_flat_no, street, landmark,
            village_town, mandal, district, state, pincode, phone_1, phone_2, category,
            customer_grade, house_type, purchase_type,
            products: Array.isArray(products) ? products : (products ? [products] : []),
            contact_date: contact_date || null,
            notes
        });

        await newContact.save();

        res.locals.data = newContact;
        res.locals.message = 'Contact inserted successfully';
        next();
    }

    async bulkInsert(req, res, next) {
        const { contacts } = req.body;
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            throw new ApiError(400, 'No contacts provided for bulk insert');
        }

        // Server-side guard mirroring the per-record requirements.
        const valid = contacts.map(c => ({
            ...c,
            full_name: typeof c.full_name === 'string' ? c.full_name.trim() : '',
            village_town: typeof c.village_town === 'string' ? c.village_town.trim() : '',
            phone_1: typeof c.phone_1 === 'string' || typeof c.phone_1 === 'number' ? String(c.phone_1).trim() : '',
            phone_2: typeof c.phone_2 === 'string' || typeof c.phone_2 === 'number' ? String(c.phone_2).trim() : ''
        })).filter(c => {
            if (!c.full_name || !c.village_town || !c.phone_1) return false;
            if (!/^\d{10}$/.test(c.phone_1)) return false;
            if (c.phone_2 && !/^\d{10}$/.test(c.phone_2)) return false;
            return true;
        });

        if (valid.length === 0) {
            throw new ApiError(400, 'No valid contacts found: verify required fields and 10-digit phone format');
        }

        // ordered:false keeps inserting past individual failures.
        const inserted = await Contact.insertMany(valid, { ordered: false });

        res.locals.data = { count: inserted.length, skipped: contacts.length - inserted.length };
        res.locals.message = `${inserted.length} contacts imported successfully`;
        next();
    }

    async update(req, res, next) {
        const { id, ...updates } = req.body;

        if (!id) throw new ApiError(400, 'Contact ID is required');
        if (Object.keys(updates).length === 0) {
            throw new ApiError(400, 'No fields to update');
        }

        // Validate phone fields if present in the update payload
        if (updates.phone_1 !== undefined) {
            if (!/^\d{10}$/.test(updates.phone_1)) {
                throw new ApiError(400, 'Phone 1 must be exactly 10 digits');
            }
        }
        if (updates.phone_2 !== undefined && updates.phone_2 !== null && updates.phone_2 !== '') {
            if (!/^\d{10}$/.test(updates.phone_2)) {
                throw new ApiError(400, 'Phone 2 must be exactly 10 digits');
            }
        }

        // Trim required string fields
        if (updates.full_name !== undefined) updates.full_name = updates.full_name.trim();
        if (updates.village_town !== undefined) updates.village_town = updates.village_town.trim();

        if (updates.full_name !== undefined && !updates.full_name) throw new ApiError(400, 'Full name cannot be empty');
        if (updates.village_town !== undefined && !updates.village_town) throw new ApiError(400, 'Village / Town cannot be empty');

        const updatedContact = await Contact.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!updatedContact) {
            throw new ApiError(404, 'Contact not found');
        }

        res.locals.data = updatedContact;
        res.locals.message = 'Contact updated successfully';
        next();
    }

    async delete(req, res, next) {
        const { id } = req.body;
        if (!id) throw new ApiError(400, 'Contact ID is required');

        const deletedContact = await Contact.findByIdAndDelete(id);
        if (!deletedContact) {
            throw new ApiError(404, 'Contact not found');
        }

        res.locals.data = null;
        res.locals.message = 'Contact deleted successfully';
        next();
    }
}
