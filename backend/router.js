import express from 'express';
import contactController from './controllers/ContactController.js';
import AuthController from './controllers/AuthController.js';
import LocationController from './controllers/LocationController.js';
import UserController from './controllers/UserController.js';
import { responsedata } from './methods.js';
import { auth } from './middleware/auth.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { authLimiter } from './middleware/rateLimiter.js';

const router = express.Router();
const contact = new contactController();
const authCtrl = new AuthController();
const locationCtrl = new LocationController();
const userCtrl = new UserController();

// Bind a controller method and wrap it so async errors reach the error handler.
const h = (instance, method) => asyncHandler(instance[method].bind(instance));

// Auth routes (public, rate-limited)
router.post('/login', authLimiter, h(authCtrl, 'login'), responsedata);
router.post('/register', authLimiter, h(authCtrl, 'register'), responsedata);

// User routes (protected)
router.post('/user/change-password', auth, h(userCtrl, 'changePassword'), responsedata);

// Location routes (public read, protected write)
router.post('/location/list', h(locationCtrl, 'getAll'), responsedata);
router.post('/location/states-districts', h(locationCtrl, 'getStatesDistricts'), responsedata);
router.post('/location/cities', h(locationCtrl, 'getCities'), responsedata);
router.post('/location/add-state', auth, h(locationCtrl, 'addState'), responsedata);
router.post('/location/delete-state', auth, h(locationCtrl, 'deleteState'), responsedata);
router.post('/location/add-district', auth, h(locationCtrl, 'addDistrict'), responsedata);
router.post('/location/delete-district', auth, h(locationCtrl, 'deleteDistrict'), responsedata);
router.post('/location/add-city', auth, h(locationCtrl, 'addCity'), responsedata);
router.post('/location/delete-city', auth, h(locationCtrl, 'deleteCity'), responsedata);

// Contact routes (protected)
router.post('/contact/insert', auth, h(contact, 'insert'), responsedata);
router.post('/contact/bulk-insert', auth, h(contact, 'bulkInsert'), responsedata);
router.post('/contact/update', auth, h(contact, 'update'), responsedata);
router.post('/contact/delete', auth, h(contact, 'delete'), responsedata);
router.post('/contact/list', auth, h(contact, 'getAll'), responsedata);
router.post('/contact/filter-options', auth, h(contact, 'getFilterOptions'), responsedata);
router.post('/contact/town-suggestions', auth, h(contact, 'getTownSuggestions'), responsedata);
router.post('/contact/get', auth, h(contact, 'getById'), responsedata);

export default router;
