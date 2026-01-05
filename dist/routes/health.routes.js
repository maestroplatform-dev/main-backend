"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../config/database"));
const router = (0, express_1.Router)();
router.get('/health', async (_req, res) => {
    try {
        // Check database connection
        await database_1.default.$queryRaw `SELECT 1`;
        res.json({
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
            },
        });
    }
    catch (error) {
        res.status(503).json({
            success: false,
            error: {
                message: 'Service unhealthy',
                code: 'UNHEALTHY',
            },
        });
    }
});
router.get('/', (_req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Maestra API is running',
            version: '1.0.0',
            docs: '/api-docs',
        },
    });
});
exports.default = router;
//# sourceMappingURL=health.routes.js.map