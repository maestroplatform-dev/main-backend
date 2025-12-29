export declare class AuthService {
    static validateToken(token: string): Promise<import("@supabase/auth-js").User>;
    static register(userId: string, email: string, name: string, role: string): Promise<{
        profile: {
            id: string;
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
        };
        email: string;
        name: string;
    }>;
    static getCurrentUser(userId: string): Promise<{
        students: {
            id: string;
            created_at: Date | null;
        } | null;
        teachers: {
            id: string;
            created_at: Date | null;
            bio: string | null;
            experience_years: number | null;
            verified: boolean | null;
        } | null;
    } & {
        id: string;
        name: string | null;
        role: string;
        is_active: boolean | null;
        created_at: Date | null;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map