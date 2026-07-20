import mongoose from 'mongoose';
import User from '../models/User.js';

export default class AdminController {
    async getDbStats(req, res, next) {
        // We use mongoose.connection.db to access the underlying native MongoDB driver
        const db = mongoose.connection.db;
        
        if (!db) {
            throw new Error("Database connection not established");
        }

        const stats = await db.stats();
        
        res.locals.data = {
            dbName: stats.db,
            collections: stats.collections,
            objects: stats.objects,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes,
            indexSize: stats.indexSize,
            fsTotalSize: stats.fsTotalSize,
            fsUsedSize: stats.fsUsedSize
        };
        next();
    }

    async ping(req, res, next) {
        res.locals.data = { status: 'alive', timestamp: new Date() };
        next();
    }

    async getKeepAliveStatus(req, res, next) {
        const user = await User.findOne();
        res.locals.data = { keepAliveEnabled: user?.keepAliveEnabled || false };
        next();
    }

    async toggleKeepAlive(req, res, next) {
        let user = await User.findOne();
        if (!user) throw new Error("No superadmin found to update");
        
        user.keepAliveEnabled = !user.keepAliveEnabled;
        await user.save();
        
        res.locals.data = { keepAliveEnabled: user.keepAliveEnabled };
        next();
    }
}
