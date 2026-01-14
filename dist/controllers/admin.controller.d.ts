import { Response } from 'express';
import { AuthRequest } from '../types';
export declare class AdminController {
    static registerTeacher(req: AuthRequest, res: Response): Promise<void>;
    static getDashboardStats(_req: AuthRequest, res: Response): Promise<void>;
    static listTeachers(req: AuthRequest, res: Response): Promise<void>;
    static getTeacherDetails(req: AuthRequest, res: Response): Promise<void>;
    static updateTeacherVerification(req: AuthRequest, res: Response): Promise<void>;
    static listUsers(req: AuthRequest, res: Response): Promise<void>;
    static updateUserStatus(req: AuthRequest, res: Response): Promise<void>;
    static getAuditLogs(req: AuthRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=admin.controller.d.ts.map