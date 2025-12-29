import { Request } from 'express';
export interface AuthUser {
    id: string;
    email: string;
    role: string;
}
export interface AuthRequest extends Request {
    user?: AuthUser;
}
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    code: string;
    constructor(statusCode: number, message: string, code?: string);
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code: string;
    };
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
    };
}
//# sourceMappingURL=index.d.ts.map