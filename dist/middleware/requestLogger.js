"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = require("crypto");
const requestLogger = (req, res, next) => {
    const incomingId = req.headers['x-request-id'];
    const reqId = incomingId || (0, crypto_1.randomUUID)();
    // attach id to response so clients can correlate
    if (!res.getHeader('X-Request-Id')) {
        res.setHeader('X-Request-Id', reqId);
    }
    const start = process.hrtime.bigint();
    const ts = new Date().toISOString();
    logger_1.default.info({ reqId, ts, method: req.method, path: req.path }, `→ ${req.method} ${req.path}`);
    res.once('finish', () => {
        const diff = Number(process.hrtime.bigint() - start) / 1e6;
        const durationMs = Math.round(diff * 100) / 100;
        const meta = {
            reqId,
            ts,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs,
        };
        if (res.statusCode >= 500) {
            logger_1.default.error(meta, `← ${res.statusCode} ${req.method} ${req.path} ${durationMs}ms`);
        }
        else if (res.statusCode >= 400) {
            logger_1.default.warn(meta, `← ${res.statusCode} ${req.method} ${req.path} ${durationMs}ms`);
        }
        else {
            logger_1.default.info(meta, `← ${res.statusCode} ${req.method} ${req.path} ${durationMs}ms`);
        }
    });
    next();
};
exports.requestLogger = requestLogger;
exports.default = exports.requestLogger;
//# sourceMappingURL=requestLogger.js.map