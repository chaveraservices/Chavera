import Location from '../models/Location.js';
import ApiError from '../utils/ApiError.js';

export default class LocationController {

    // GET all states with their districts and cities
    async getAll(req, res, next) {
        const locations = await Location.find().sort({ state: 1 });
        res.locals.data = locations;
        res.locals.message = 'Locations fetched successfully';
        next();
    }

    // Lightweight: states + district names only (NO cities). Keeps the form's
    // initial payload tiny even with 150k+ cities in the DB.
    async getStatesDistricts(req, res, next) {
        const locations = await Location.find({}, { state: 1, 'districts.name': 1 }).sort({ state: 1 });
        res.locals.data = locations.map(l => ({
            state: l.state,
            districts: (l.districts || []).map(d => d.name),
        }));
        res.locals.message = 'States and districts fetched successfully';
        next();
    }

    // Cities for a single state+district (lazy-loaded when a district is chosen).
    async getCities(req, res, next) {
        const { state, district } = req.body || {};
        if (!state || !district) {
            throw new ApiError(400, 'State and district are required');
        }
        const result = await Location.aggregate([
            { $match: { state: String(state) } },
            { $unwind: '$districts' },
            { $match: { 'districts.name': String(district) } },
            { $project: { _id: 0, cities: '$districts.cities' } },
        ]);
        res.locals.data = (result[0] && result[0].cities) || [];
        res.locals.message = 'Cities fetched successfully';
        next();
    }

    async addState(req, res, next) {
        const { state } = req.body;
        if (typeof state !== 'string' || !state.trim()) {
            throw new ApiError(400, 'State name is required');
        }

        const exists = await Location.findOne({ 
            state: { $regex: new RegExp(`^${state.trim()}$`, 'i') } 
        });
        if (exists) {
            throw new ApiError(409, 'State already exists');
        }

        const newLocation = new Location({ state: state.trim(), districts: [] });
        await newLocation.save();

        res.locals.data = newLocation;
        res.locals.message = `State "${state.trim()}" added successfully`;
        next();
    }

    async deleteState(req, res, next) {
        const { state } = req.body;
        if (typeof state !== 'string' || !state.trim()) {
            throw new ApiError(400, 'State name is required');
        }

        const deleted = await Location.findOneAndDelete({ state });
        if (!deleted) {
            throw new ApiError(404, 'State not found');
        }

        res.locals.data = null;
        res.locals.message = `State "${state}" deleted successfully`;
        next();
    }

    async addDistrict(req, res, next) {
        const { state, district } = req.body;
        if (typeof state !== 'string' || typeof district !== 'string' || !district.trim()) {
            throw new ApiError(400, 'State and district name are required');
        }

        const location = await Location.findOne({ state });
        if (!location) {
            throw new ApiError(404, 'State not found');
        }

        const districtTrimmed = district.trim();
        const districtExists = location.districts.some(d => d.name.toLowerCase() === districtTrimmed.toLowerCase());

        if (districtExists) {
            throw new ApiError(409, 'District already exists in this state');
        }

        location.districts.push({ name: districtTrimmed, cities: [] });
        location.districts.sort((a, b) => a.name.localeCompare(b.name));
        await location.save();

        res.locals.data = location;
        res.locals.message = `District "${districtTrimmed}" added to "${state}"`;
        next();
    }

    async deleteDistrict(req, res, next) {
        const { state, district } = req.body;
        if (typeof state !== 'string' || typeof district !== 'string') {
            throw new ApiError(400, 'State and district name are required');
        }

        const location = await Location.findOne({ state });
        if (!location) {
            throw new ApiError(404, 'State not found');
        }

        location.districts = location.districts.filter(d => d.name !== district);
        await location.save();

        res.locals.data = location;
        res.locals.message = `District "${district}" removed from "${state}"`;
        next();
    }

    async addCity(req, res, next) {
        const { state, district, city } = req.body;
        if (typeof state !== 'string' || typeof district !== 'string' || typeof city !== 'string' || !city.trim()) {
            throw new ApiError(400, 'State, district, and city names are required');
        }

        const location = await Location.findOne({ state });
        if (!location) {
            throw new ApiError(404, 'State not found');
        }

        const districtObj = location.districts.find(d => d.name === district);
        if (!districtObj) {
            throw new ApiError(404, 'District not found in this state');
        }

        if (!districtObj.cities) districtObj.cities = [];
        const cityTrimmed = city.trim();
        if (districtObj.cities.some(c => c.toLowerCase() === cityTrimmed.toLowerCase())) {
            throw new ApiError(409, 'City already exists in this district');
        }

        districtObj.cities.push(cityTrimmed);
        districtObj.cities.sort();
        await location.save();

        res.locals.data = location;
        res.locals.message = `City "${cityTrimmed}" added to "${district}"`;
        next();
    }

    async deleteCity(req, res, next) {
        const { state, district, city } = req.body;
        if (typeof state !== 'string' || typeof district !== 'string' || typeof city !== 'string') {
            throw new ApiError(400, 'State, district, and city names are required');
        }

        const location = await Location.findOne({ state });
        if (!location) {
            throw new ApiError(404, 'State not found');
        }

        const districtObj = location.districts.find(d => d.name === district);
        if (!districtObj) {
            throw new ApiError(404, 'District not found in this state');
        }

        if (!districtObj.cities) districtObj.cities = [];
        districtObj.cities = districtObj.cities.filter(c => c !== city);
        await location.save();

        res.locals.data = location;
        res.locals.message = `City "${city}" removed from "${district}"`;
        next();
    }
}
