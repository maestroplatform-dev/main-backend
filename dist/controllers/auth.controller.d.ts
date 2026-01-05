import { Response } from 'express';
import { AuthRequest } from '../types';
export declare class AuthController {
    static register(req: AuthRequest, res: Response): Promise<void>;
    static getCurrentUser(req: AuthRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map