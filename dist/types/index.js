"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    message;
    code;
    constructor(statusCode, message, code = 'ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.code = code;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
//# sourceMappingURL=index.js.map