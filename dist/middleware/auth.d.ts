import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare function validateSupabaseToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function authenticateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
export declare function requireRole(...roles: string[]): (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map