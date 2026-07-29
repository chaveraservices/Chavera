import Contact from '../models/Contact.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

const REQUIRED_MSG = 'Missing required fields: full_name, village_town, or phone_1';

// Series code: up to 3 letters, upper-cased (A, AA, AB). Blank → null.
const cleanSeriesCode = (raw) => {
    const s = String(raw ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    return s || null;
};

// Keep only sensible per-product quantities (whole numbers > 1). Quantity 1 is
// the default, so it isn't stored — a missing key just means "one".
const cleanQuantities = (raw) => {
    const out = {};
    if (raw && typeof raw === 'object') {
        for (const [name, v] of Object.entries(raw)) {
            const n = parseInt(v, 10);
            if (Number.isFinite(n) && n > 1) out[name] = n;
        }
    }
    return out;
};

// Escape user input before using it inside a RegExp.
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// India Post pincode lookup by place name via the free, no-auth
// api.postalpincode.in directory. Returns a 6-digit pincode string, or null.
// Cached in-process (place names repeat a lot) and time-limited so a slow or
// down API never hangs the request — it just falls back to learned data.
const pincodeCache = new Map();
const lookupIndiaPost = async (town, district, state) => {
    const key = `${town}|${district || ''}|${state || ''}`.toLowerCase();
    if (pincodeCache.has(key)) return pincodeCache.get(key);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
        const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(town)}`, { signal: ctrl.signal });
        const body = await res.json();
        const entry = Array.isArray(body) ? body[0] : null;
        let offices = entry && entry.Status === 'Success' && Array.isArray(entry.PostOffice) ? entry.PostOffice : [];

        // Narrow to the chosen district, then state — but only if that leaves a
        // match, so a mismatch in one field doesn't discard a valid result.
        if (district) {
            const d = offices.filter(o => (o.District || '').toLowerCase() === String(district).toLowerCase());
            if (d.length) offices = d;
        }
        if (state) {
            const s = offices.filter(o => (o.State || '').toLowerCase() === String(state).toLowerCase());
            if (s.length) offices = s;
        }

        const pin = offices[0]?.Pincode || null;
        pincodeCache.set(key, pin);
        return pin;
    } finally {
        clearTimeout(timer);
    }
};

// A contact's effective date for range filtering: the manually entered
// contact_date, falling back to when the record was created. Contacts imported
// before the Date column existed have no contact_date, and dropping them from
// every range would make the dashboard look empty rather than honest.
const EFFECTIVE_DATE = { $ifNull: ['$contact_date', '$createdAt'] };

// Next human-facing entry number. Reads the current max rather than keeping a
// counter document, so it stays correct after imports, restores, and deletions.
// This is a single-writer office app; if it ever becomes concurrent, move to a
// findOneAndUpdate counter — a race here would hand two entries the same number.
const nextEntryNo = async () => {
    const top = await Contact.findOne({ entry_no: { $ne: null } })
        .sort({ entry_no: -1 })
        .select('entry_no')
        .lean();
    return (top?.entry_no || 0) + 1;
};

// True if some other entry already carries this number. `excludeId` skips the
// entry being edited, so re-saving a record without changing its number is fine.
// Guards the manual-override path against duplicate entry numbers.
const entryNoTaken = async (no, excludeId = null) => {
    const query = { entry_no: no };
    if (excludeId) query._id = { $ne: excludeId };
    const hit = await Contact.findOne(query).select('_id').lean();
    return !!hit;
};

// Builds the $expr for a [from, to] window. Dates arrive as 'YYYY-MM-DD' and are
// interpreted in server-local time, inclusive of the whole `to` day. Returns
// null when no usable bound was supplied, so callers can skip the stage.
const dateRangeExpr = (from, to) => {
    const conds = [];
    const parse = (v, endOfDay) => {
        if (!v || typeof v !== 'string') return null;
        const d = /^\d{4}-\d{2}-\d{2}$/.test(v)
            ? new Date(`${v}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
            : new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    };
    const f = parse(from, false);
    const t = parse(to, true);
    if (f) conds.push({ $gte: [EFFECTIVE_DATE, f] });
    if (t) conds.push({ $lte: [EFFECTIVE_DATE, t] });
    return conds.length ? { $and: conds } : null;
};

export default class ContactController {
    // Paginated + filtered list.
    // Body: { page, pageSize, search, state, district, city, category, all }
    async getAll(req, res, next) {
        const { search, state, district, city, category, relation, customer_grade, house_type, purchase_type, product, all, years_ago } = req.body || {};

        const query = {};

        // "Bought N years ago" — the window [N+1 years ago, N years ago), so
        // years_ago=2 means purchases in that contact's third year back, not
        // "any time in the last 2 years". Non-overlapping buckets, so the
        // counts across 2/3/4/5/6 never double-count the same contact.
        const yearsBack = parseInt(years_ago, 10);
        if (Number.isInteger(yearsBack) && yearsBack > 0) {
            const now = new Date();
            const upper = new Date(now.getFullYear() - yearsBack, now.getMonth(), now.getDate());
            const lower = new Date(now.getFullYear() - (yearsBack + 1), now.getMonth(), now.getDate());
            query.$expr = { $and: [{ $gte: [EFFECTIVE_DATE, lower] }, { $lt: [EFFECTIVE_DATE, upper] }] };
        }
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

        // Newest entry first: the last entry made (highest entry_no) tops the
        // list. createdAt is the tiebreaker / fallback for legacy rows that have
        // no entry_no (those sort to the bottom).
        const items = await Contact.find(query)
            .sort({ entry_no: -1, createdAt: -1 })
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

    // Aggregated analytics for the dashboard.
    // Body: { from, to } — optional 'YYYY-MM-DD' window scoping every figure.
    async getAnalytics(req, res, next) {
        const { from, to, product } = req.body || {};
        const range = dateRangeExpr(from, to);
        // Prepended to every pipeline so the whole dashboard moves together.
        // Optional product filter narrows to contacts that include that product.
        const baseMatch = {};
        if (range) baseMatch.$expr = range;
        if (product) baseMatch.products = String(product);
        const scope = Object.keys(baseMatch).length ? [{ $match: baseMatch }] : [];
        const scopeQuery = baseMatch;

        const groupCount = (field, limit) => Contact.aggregate([
            ...scope,
            { $match: { [field]: { $nin: [null, ''] } } },
            { $group: { _id: `$${field}`, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            ...(limit ? [{ $limit: limit }] : []),
            { $project: { _id: 0, label: '$_id', count: 1 } },
        ]);

        const [total, cancelledCount, byProduct, productContacts, byCategory, byPurchase, byGrade, byHouse, byState] = await Promise.all([
            Contact.countDocuments(scopeQuery),
            Contact.countDocuments({ ...scopeQuery, cancelled: true }),
            Contact.aggregate([
                ...scope,
                { $unwind: '$products' },
                { $match: { products: { $nin: [null, ''] } } },
                { $group: { _id: '$products', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $project: { _id: 0, label: '$_id', count: 1 } },
            ]),
            // Contacts with at least one product. Distinct from the sum of
            // byProduct counts, because products is multi-select — a contact
            // buying a cot and a sofa set is counted once here but twice there.
            Contact.countDocuments({ ...scopeQuery, 'products.0': { $exists: true } }),
            groupCount('category'),
            groupCount('purchase_type'),
            groupCount('customer_grade'),
            groupCount('house_type'),
            groupCount('state', 8),
        ]);

        res.locals.data = { total, cancelledCount, byProduct, productContacts, byCategory, byPurchase, byGrade, byHouse, byState };
        res.locals.message = 'Analytics fetched successfully';
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

    // Auto-fill a pincode for a village/town. Two sources, in order:
    //   1. India Post (api.postalpincode.in) — the official directory, covers
    //      real towns and cities. Free, no key.
    //   2. What's already been entered here — covers the tiny villages India
    //      Post doesn't list, once a pincode has been recorded for them once.
    async getPincodeSuggestion(req, res, next) {
        const { village_town, district, state } = req.body || {};
        const town = String(village_town || '').trim();
        if (!town) { res.locals.data = { pincode: null }; return next(); }

        // 1. India Post lookup by place name, narrowed by district then state.
        try {
            const pin = await lookupIndiaPost(town, district, state);
            if (pin) { res.locals.data = { pincode: pin, source: 'indiapost' }; res.locals.message = 'Pincode found'; return next(); }
        } catch { /* fall through to history */ }

        // 2. Learned from previous entries for the same place.
        const esc = escapeRegex(town);
        const match = { village_town: new RegExp(`^${esc}$`, 'i'), pincode: { $nin: [null, ''] } };
        if (district) match.district = String(district);
        if (state) match.state = String(state);
        const rows = await Contact.aggregate([
            { $match: match },
            { $group: { _id: '$pincode', n: { $sum: 1 } } },
            { $sort: { n: -1 } },
            { $limit: 1 },
        ]);

        res.locals.data = { pincode: rows[0]?._id || null, source: rows[0]?._id ? 'history' : null };
        res.locals.message = 'Pincode suggestion fetched successfully';
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
        let { honorific, full_name, relation, business_name, age, ppr, toq, instagram_id, product_name, customer_occupation, door_flat_no, street, landmark, village_town, mandal, district, state, pincode, phone_1, phone_2, phones, category, customer_grade, house_type, purchase_type, products, product_quantities, series_code, contact_date, notes, entry_no } = req.body;

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
        // Additional numbers: normalise to a clean 10-digit array.
        const cleanPhones = (Array.isArray(phones) ? phones : [])
            .map(p => String(p || '').trim())
            .filter(Boolean);
        for (const p of cleanPhones) {
            if (!/^\d{10}$/.test(p)) throw new ApiError(400, 'Each additional number must be exactly 10 digits');
        }
        // Keep phone_2 = first extra for back-compat with labels/export.
        const secondPhone = cleanPhones[0] || (phone_2 ? String(phone_2).trim() : null);

        // Snapshot the author's name so the entry keeps it even if the user is
        // later renamed or removed. The JWT carries no name, so read it once.
        const creator = req.user?.id ? await User.findById(req.user.id).select('name').lean() : null;

        // Respect a hand-entered entry number (manual override); otherwise
        // auto-assign the next one in sequence.
        const providedEntryNo = Number(entry_no);
        const usingProvided = Number.isInteger(providedEntryNo) && providedEntryNo > 0;
        // Guard against duplicates only on the manual path — auto-assigned
        // numbers are max+1 and unique by construction.
        if (usingProvided && await entryNoTaken(providedEntryNo)) {
            throw new ApiError(409, `Entry number ${providedEntryNo} is already used by another entry.`);
        }
        const finalEntryNo = usingProvided ? providedEntryNo : await nextEntryNo();

        const newContact = new Contact({
            entry_no: finalEntryNo,
            series_code: cleanSeriesCode(series_code),
            honorific, full_name, relation, business_name, age, ppr, toq, instagram_id, product_name, customer_occupation, door_flat_no, street, landmark,
            village_town, mandal, district, state, pincode, phone_1, phone_2: secondPhone, phones: cleanPhones, category,
            customer_grade, house_type, purchase_type,
            products: Array.isArray(products) ? products : (products ? [products] : []),
            product_quantities: cleanQuantities(product_quantities),
            contact_date: contact_date || null,
            notes,
            created_by: req.user?.id || null,
            created_by_name: creator?.name || null
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

        // Number the batch from the current high-water mark so imported rows
        // get readable entry numbers too, contiguous with what's already there.
        let seq = await nextEntryNo();
        const importer = req.user?.id ? await User.findById(req.user.id).select('name').lean() : null;
        for (const c of valid) {
            c.entry_no = seq++;
            c.created_by = req.user?.id || null;
            c.created_by_name = importer?.name || null;
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
        // Additional numbers array: clean, validate, and keep phone_2 in sync.
        if (updates.phones !== undefined) {
            const cleanPhones = (Array.isArray(updates.phones) ? updates.phones : [])
                .map(p => String(p || '').trim())
                .filter(Boolean);
            for (const p of cleanPhones) {
                if (!/^\d{10}$/.test(p)) throw new ApiError(400, 'Each additional number must be exactly 10 digits');
            }
            updates.phones = cleanPhones;
            updates.phone_2 = cleanPhones[0] || null;
        } else if (updates.phone_2 !== undefined && updates.phone_2 !== null && updates.phone_2 !== '') {
            if (!/^\d{10}$/.test(updates.phone_2)) {
                throw new ApiError(400, 'Phone 2 must be exactly 10 digits');
            }
        }

        if (updates.product_quantities !== undefined) {
            updates.product_quantities = cleanQuantities(updates.product_quantities);
        }
        if (updates.series_code !== undefined) {
            updates.series_code = cleanSeriesCode(updates.series_code);
        }
        // A hand-edited entry number must be a positive whole number, and can't
        // collide with another entry's number.
        if (updates.entry_no !== undefined) {
            const n = Number(updates.entry_no);
            if (!Number.isInteger(n) || n <= 0) {
                throw new ApiError(400, 'Entry number must be a positive whole number');
            }
            if (await entryNoTaken(n, id)) {
                throw new ApiError(409, `Entry number ${n} is already used by another entry.`);
            }
            updates.entry_no = n;
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

    // The entry number a new entry would receive, so the form can show it (and
    // its derived series) before the entry is saved.
    async getNextEntryNo(req, res, next) {
        const n = await nextEntryNo();
        res.locals.data = { entry_no: n };
        res.locals.message = 'Next entry number';
        next();
    }

    // Whether an entry number is already taken (optionally excluding the entry
    // being edited), so the form can warn before the user submits.
    async checkEntryNo(req, res, next) {
        const n = Number(req.body?.entry_no);
        const excludeId = req.body?.id || null;
        const taken = Number.isInteger(n) && n > 0
            ? await entryNoTaken(n, excludeId)
            : false;
        res.locals.data = { taken };
        res.locals.message = 'Entry number status';
        next();
    }

    // "Cancel bill" — mark an entry cancelled (kept for records), or restore it.
    async cancel(req, res, next) {
        const { id, cancelled = true, reason } = req.body || {};
        if (!id) throw new ApiError(400, 'Contact ID is required');

        const update = cancelled
            ? { cancelled: true, cancelled_at: new Date(), cancelled_reason: (reason || '').trim() || null }
            : { cancelled: false, cancelled_at: null, cancelled_reason: null };

        const c = await Contact.findByIdAndUpdate(id, update, { new: true });
        if (!c) throw new ApiError(404, 'Contact not found');

        res.locals.data = c;
        res.locals.message = cancelled ? 'Entry cancelled' : 'Entry restored';
        next();
    }

    // Entries grouped into series of 100 by entry_no
    // (series = floor((entry_no - 1) / 100) + 1), for the Reports view.
    async seriesReport(req, res, next) {
        const { product } = req.body || {};
        const match = { entry_no: { $ne: null } };
        if (product) match.products = String(product);
        const rows = await Contact.aggregate([
            { $match: match },
            {
                $group: {
                    _id: { $add: [{ $floor: { $divide: [{ $subtract: ['$entry_no', 1] }, 100] } }, 1] },
                    count: { $sum: 1 },
                    active: { $sum: { $cond: [{ $eq: ['$cancelled', true] }, 0, 1] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$cancelled', true] }, 1, 0] } },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const series = rows.map(r => ({
            series: r._id,
            count: r.count,
            active: r.active,
            cancelled: r.cancelled,
            from: (r._id - 1) * 100 + 1,
            to: r._id * 100,
        }));

        res.locals.data = {
            series,
            totals: {
                total: series.reduce((s, x) => s + x.count, 0),
                active: series.reduce((s, x) => s + x.active, 0),
                cancelled: series.reduce((s, x) => s + x.cancelled, 0),
                seriesCount: series.length,
            },
        };
        res.locals.message = 'Series report fetched successfully';
        next();
    }

    // Entries for one series (100-wide entry_no window), newest entry first.
    async seriesEntries(req, res, next) {
        const s = parseInt(req.body?.series, 10);
        if (!Number.isInteger(s) || s < 1) throw new ApiError(400, 'A valid series number is required');

        const from = (s - 1) * 100 + 1;
        const to = s * 100;
        const items = await Contact.find({ entry_no: { $gte: from, $lte: to } }).sort({ entry_no: -1 });

        res.locals.data = { series: s, from, to, count: items.length, items };
        res.locals.message = 'Series entries fetched successfully';
        next();
    }

    // Entries in an arbitrary entry_no range [from, to], newest entry first.
    async entriesRange(req, res, next) {
        let from = parseInt(req.body?.from, 10);
        let to = parseInt(req.body?.to, 10);
        if (!Number.isInteger(from) || !Number.isInteger(to)) {
            throw new ApiError(400, 'A valid from and to entry number are required');
        }
        if (from > to) { const t = from; from = to; to = t; }   // tolerate reversed input
        if (from < 1) from = 1;

        const query = { entry_no: { $gte: from, $lte: to } };
        if (req.body?.product) query.products = String(req.body.product);
        const items = await Contact.find(query).sort({ entry_no: -1 });

        res.locals.data = { from, to, count: items.length, items };
        res.locals.message = 'Entries in range fetched successfully';
        next();
    }
}
