"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_routes_1 = __importDefault(require("./health.routes"));
const test_routes_1 = __importDefault(require("./test.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const teachers_routes_1 = __importDefault(require("./teachers.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const router = (0, express_1.Router)();
// Health check routes (no versioning)
router.use(health_routes_1.default);
// Test routes
router.use(test_routes_1.default);
// API v1 routes
router.use('/api/v1/auth', auth_routes_1.default);
router.use('/api/v1/teachers', teachers_routes_1.default);
router.use('/api/v1/admin', admin_routes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map