"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load environment variables FIRST before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
const requestLogger_1 = __importDefault(require("./middleware/requestLogger"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Security middleware
app.use((0, helmet_1.default)());
// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Rate limiting
app.use(rateLimiter_1.apiLimiter);
// Request logging (structured)
app.use(requestLogger_1.default);
// Routes
app.use(routes_1.default);
// Error handlers (must be last)
app.use(errorHandler_1.notFoundHandler);
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🎵  MAESTRA BACKEND API');
    console.log('='.repeat(60));
    console.log(`\n✅  Server running on: http://localhost:${PORT}`);
    console.log(`📝  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐  CORS enabled for: ${allowedOrigins.length} origins`);
    console.log(`⏰  Started at: ${new Date().toLocaleString()}`);
    console.log('\n' + '='.repeat(60));
    console.log('📡  Endpoints:');
    console.log(`    GET  /health`);
    console.log(`    GET  /api/v1/test`);
    console.log('='.repeat(60) + '\n');
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n👋 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('\n👋 SIGINT received, shutting down gracefully...');
    process.exit(0);
});
exports.default = app;
//# sourceMappingURL=index.js.map