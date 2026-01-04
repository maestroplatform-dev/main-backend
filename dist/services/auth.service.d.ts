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
            name: string | null;
            created_at: Date | null;
        } | null;
        teachers: {
            id: string;
            name: string | null;
            created_at: Date | null;
            bio: string | null;
            experience_years: number | null;
            phone: string | null;
            date_of_birth: Date | null;
            music_experience_years: number | null;
            teaching_experience_years: number | null;
            performance_experience_years: number | null;
            current_city: string | null;
            pincode: string | null;
            demo_session_available: boolean | null;
            media_consent: boolean | null;
            engagement_type: string | null;
            international_premium: import("@prisma/client-runtime-utils").Decimal | null;
            open_to_international: boolean | null;
            onboarding_completed: boolean | null;
            verified: boolean | null;
            updated_at: Date | null;
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