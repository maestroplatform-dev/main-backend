"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const database_1 = __importDefault(require("../config/database"));
class AdminController {
    static async listProfiles(_req, res) {
        const profiles = await database_1.default.profiles.findMany({
            include: {
                students: true,
                teachers: true,
            },
            orderBy: {
                created_at: 'desc',
            },
            take: 100,
        });
        res.json({
            success: true,
            data: profiles,
        });
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=admin.controller.js.map