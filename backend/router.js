import express from 'express';
import contactController from './controllers/ContactController.js';
import AuthController from './controllers/AuthController.js';
import LocationController from './controllers/LocationController.js';
import UserController from './controllers/UserController.js';
import AdminController from './controllers/AdminController.js';
import ProductController from './controllers/ProductController.js';
import { responsedata } from './methods.js';
import { auth } from './middleware/auth.js';
import { requireRole } from './middleware/requireRole.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import { authLimiter } from './middleware/rateLimiter.js';

const router = express.Router();
const contact = new contactController();
const authCtrl = new AuthController();
const locationCtrl = new LocationController();
const userCtrl = new UserController();
const adminCtrl = new AdminController();
const productCtrl = new ProductController();

// Bind a controller method and wrap it so async errors reach the error handler.
const h = (instance, method) => asyncHandler(instance[method].bind(instance));

// Auth routes (public, rate-limited)
router.post('/login', authLimiter, h(authCtrl, 'login'), responsedata);
router.post('/register', authLimiter, auth, requireRole('admin'), h(authCtrl, 'register'), responsedata);

// User routes (protected)
router.post('/user/change-password', auth, h(userCtrl, 'changePassword'), responsedata);
router.post('/user/me', auth, h(userCtrl, 'me'), responsedata);

// User access management — admin only
router.post('/user/list', auth, requireRole('admin'), h(userCtrl, 'list'), responsedata);
router.post('/user/create', auth, requireRole('admin'), h(userCtrl, 'create'), responsedata);
router.post('/user/update-role', auth, requireRole('admin'), h(userCtrl, 'updateRole'), responsedata);
router.post('/user/remove', auth, requireRole('admin'), h(userCtrl, 'remove'), responsedata);
router.post('/user/reset-password', auth, requireRole('admin'), h(userCtrl, 'resetPassword'), responsedata);

// Admin routes (protected)
router.post('/admin/db-stats', auth, requireRole('admin'), h(adminCtrl, 'getDbStats'), responsedata);
router.post('/admin/keep-alive-status', auth, requireRole('admin'), h(adminCtrl, 'getKeepAliveStatus'), responsedata);
router.post('/admin/toggle-keep-alive', auth, requireRole('admin'), h(adminCtrl, 'toggleKeepAlive'), responsedata);

// Health/Ping (public)
router.post('/ping', h(adminCtrl, 'ping'), responsedata);

// Location routes (public read, protected write)
router.post('/location/list', h(locationCtrl, 'getAll'), responsedata);
router.post('/location/states-districts', h(locationCtrl, 'getStatesDistricts'), responsedata);
router.post('/location/cities', h(locationCtrl, 'getCities'), responsedata);
router.post('/location/add-state', auth, requireRole('admin'), h(locationCtrl, 'addState'), responsedata);
router.post('/location/delete-state', auth, requireRole('admin'), h(locationCtrl, 'deleteState'), responsedata);
router.post('/location/add-district', auth, requireRole('admin'), h(locationCtrl, 'addDistrict'), responsedata);
router.post('/location/delete-district', auth, requireRole('admin'), h(locationCtrl, 'deleteDistrict'), responsedata);
router.post('/location/add-city', auth, requireRole('admin'), h(locationCtrl, 'addCity'), responsedata);
router.post('/location/delete-city', auth, requireRole('admin'), h(locationCtrl, 'deleteCity'), responsedata);

// Product catalogue — list for everyone, management for admins
router.post('/product/list', auth, h(productCtrl, 'list'), responsedata);
router.post('/product/create', auth, requireRole('admin'), h(productCtrl, 'create'), responsedata);
router.post('/product/update', auth, requireRole('admin'), h(productCtrl, 'update'), responsedata);
router.post('/product/remove', auth, requireRole('admin'), h(productCtrl, 'remove'), responsedata);

// Contact routes (protected)
router.post('/contact/insert', auth, h(contact, 'insert'), responsedata);
router.post('/contact/bulk-insert', auth, requireRole('admin'), h(contact, 'bulkInsert'), responsedata);
router.post('/contact/update', auth, h(contact, 'update'), responsedata);
router.post('/contact/delete', auth, requireRole('admin'), h(contact, 'delete'), responsedata);
router.post('/contact/cancel', auth, requireRole('admin'), h(contact, 'cancel'), responsedata);
router.post('/contact/list', auth, h(contact, 'getAll'), responsedata);
router.post('/contact/filter-options', auth, h(contact, 'getFilterOptions'), responsedata);
router.post('/contact/analytics', auth, h(contact, 'getAnalytics'), responsedata);
router.post('/contact/next-entry-no', auth, h(contact, 'getNextEntryNo'), responsedata);
router.post('/contact/check-entry-no', auth, h(contact, 'checkEntryNo'), responsedata);
router.post('/contact/series-report', auth, h(contact, 'seriesReport'), responsedata);
router.post('/contact/series-entries', auth, h(contact, 'seriesEntries'), responsedata);
router.post('/contact/entries-range', auth, h(contact, 'entriesRange'), responsedata);
router.post('/contact/town-suggestions', auth, h(contact, 'getTownSuggestions'), responsedata);
router.post('/contact/pincode-suggestion', auth, h(contact, 'getPincodeSuggestion'), responsedata);
router.post('/contact/get', auth, h(contact, 'getById'), responsedata);

export default router;
