import { Request, Response } from 'express';
import { AuthRequest } from '../types';
export declare class TeacherController {
    static onboard(req: AuthRequest, res: Response): Promise<void>;
    static getOwnProfile(req: AuthRequest, res: Response): Promise<void>;
    static getTeacherById(req: Request, res: Response): Promise<void>;
    static updateProfile(req: AuthRequest, res: Response): Promise<void>;
    static getAllTeachers(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=teacher.controller.d.ts.map