import mongoose from 'mongoose';

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
}
