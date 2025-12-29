"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_1 = require("../middleware/auth");
const asyncHandler_1 = require("../utils/asyncHandler");
const router = (0, express_1.Router)();
// GET /api/v1/admin/profiles - list profiles (admin only)
router.get('/profiles', auth_1.authenticateUser, (0, auth_1.requireRole)('admin'), (0, asyncHandler_1.asyncHandler)(admin_controller_1.AdminController.listProfiles));
exports.default = router;
//# sourceMappingURL=admin.routes.js.map