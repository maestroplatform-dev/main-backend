"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageCardService = void 0;
const database_1 = __importDefault(require("../config/database"));
const types_1 = require("../types");
const levelValues = ['beginner', 'intermediate', 'advanced'];
function assertLevel(level) {
    if (!levelValues.includes(level)) {
        throw new types_1.AppError(400, 'Invalid level', 'INVALID_LEVEL');
    }
}
function validatePoints(points) {
    if (!Array.isArray(points) || points.length !== 4 || points.some((p) => typeof p !== 'string' || p.trim().length === 0)) {
        throw new types_1.AppError(400, 'Package card must have exactly 4 non-empty points', 'INVALID_POINTS');
    }
}
class PackageCardService {
    static async getForStudent(studentId) {
        const student = await database_1.default.students.findUnique({
            where: { id: studentId },
            select: { id: true, level: true },
        });
        if (!student) {
            throw new types_1.AppError(404, 'Student not found', 'STUDENT_NOT_FOUND');
        }
        const override = await database_1.default.student_package_card_overrides.findUnique({
            where: { student_id: studentId },
            select: { points: true },
        });
        if (override?.points?.length) {
            return {
                level: student.level,
                points: override.points,
                source: 'override',
            };
        }
        const template = await database_1.default.package_card_templates.findUnique({
            where: { level: student.level },
            select: { points: true },
        });
        return {
            level: student.level,
            points: template?.points?.length ? template.points : null,
            source: template?.points?.length ? 'template' : 'none',
        };
    }
    static async listTemplates() {
        const templates = await database_1.default.package_card_templates.findMany({
            orderBy: { level: 'asc' },
            select: { level: true, points: true, updated_at: true },
        });
        return templates;
    }
    static async upsertTemplate(level, points) {
        const parsedLevel = level;
        assertLevel(parsedLevel);
        validatePoints(points);
        const template = await database_1.default.package_card_templates.upsert({
            where: { level: parsedLevel },
            create: { level: parsedLevel, points },
            update: { points, updated_at: new Date() },
            select: { level: true, points: true, updated_at: true },
        });
        return template;
    }
    static async updateStudentPackageCard(studentId, input) {
        const maybeLevel = input.level;
        if (maybeLevel)
            assertLevel(maybeLevel);
        if (input.points)
            validatePoints(input.points);
        const student = await database_1.default.students.findUnique({
            where: { id: studentId },
            select: { id: true },
        });
        if (!student) {
            throw new types_1.AppError(404, 'Student not found', 'STUDENT_NOT_FOUND');
        }
        if (maybeLevel) {
            await database_1.default.students.update({
                where: { id: studentId },
                data: { level: maybeLevel },
            });
        }
        if (input.clearOverride) {
            await database_1.default.student_package_card_overrides.deleteMany({
                where: { student_id: studentId },
            });
        }
        if (input.points) {
            await database_1.default.student_package_card_overrides.upsert({
                where: { student_id: studentId },
                create: { student_id: studentId, points: input.points },
                update: { points: input.points, updated_at: new Date() },
            });
        }
        return this.getForStudent(studentId);
    }
}
exports.PackageCardService = PackageCardService;
//# sourceMappingURL=package-card.service.js.map