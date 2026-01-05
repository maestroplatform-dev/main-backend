"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Simple test endpoint - no auth required
router.get('/api/v1/test', (_req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Backend is connected! 🎉',
            timestamp: new Date().toISOString(),
            endpoints: {
                health: '/health',
                teachers: '/api/v1/teachers (coming soon)',
                bookings: '/api/v1/bookings (coming soon)',
            },
        },
    });
});
// Echo endpoint - returns what you send
router.post('/api/v1/echo', (req, res) => {
    res.json({
        success: true,
        data: {
            received: req.body,
            headers: {
                'content-type': req.headers['content-type'],
                authorization: req.headers.authorization ? 'Bearer token received' : 'No token',
            },
        },
    });
});
exports.default = router;
//# sourceMappingURL=test.routes.js.map