import User from '../models/User.js';

export function initKeepAlive() {
    const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

    setInterval(async () => {
        try {
            const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
            const isUAT = process.env.APP_ENV === 'uat';
            console.log("UAT established---------:",isUAT)
            let shouldPing = false;

            if (isProduction) {
                shouldPing = true; // Always ping without breaking in production
            } else if (isUAT) {
                // In UAT, only ping if enabled from the UI settings
                const user = await User.findOne();
                if (user && user.keepAliveEnabled) {
                    shouldPing = true;
                }
            }

            if (shouldPing) {
                const port = process.env.PORT || 3001;
                // Render exposes RENDER_EXTERNAL_URL for web services
                const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
                const pingUrl = `${baseUrl}/api/ping`;
                
                console.log(`[KeepAlive] Pinging ${pingUrl}...`);
                const response = await fetch(pingUrl, { method: 'POST' });
                
                if (response.ok) {
                    console.log(`[KeepAlive] Ping successful at ${new Date().toISOString()}`);
                } else {
                    console.error(`[KeepAlive] Ping failed with status ${response.status}`);
                }
            }
        } catch (error) {
            console.error('[KeepAlive] Error during ping interval:', error.message);
        }
    }, INTERVAL_MS);

    console.log('[KeepAlive] Initialized 14-minute interval script.');
}
