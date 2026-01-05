"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const types_1 = require("../types");
const errorHandler = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    const timestamp = new Date().toLocaleTimeString();
    console.error(`\n❌ [${timestamp}] ERROR: ${err.message}`);
    console.error(`   Path: ${req.method} ${req.path}`);
    if (process.env.NODE_ENV === 'development') {
        console.error(`   Stack: ${err.stack?.split('\\n')[1]?.trim()}`);
    }
    if (err instanceof types_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                code: err.code,
            },
        });
    }
    // Default error
    return res.status(500).json({
        success: false,
        error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
        },
    });
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            message: 'Route not found',
            code: 'NOT_FOUND',
        },
    });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map