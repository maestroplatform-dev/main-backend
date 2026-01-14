export declare class AuthService {
    static validateToken(token: string): Promise<import("@supabase/auth-js").User>;
    static register(userId: string, email: string, name: string, role: string): Promise<{
        profile: {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        };
        email: string;
        name: string;
    }>;
    static getCurrentUser(userId: string): Promise<{
        students: {
            id: string;
            created_at: Date | null;
            name: string | null;
            date_of_birth: Date | null;
            updated_at: Date | null;
            email_verified: boolean;
            gender: string | null;
            guardian_name: string | null;
            guardian_phone: string | null;
            onboarding_status: string;
            profile_picture_url: string | null;
            signup_method: string;
        } | null;
        teachers: {
            id: string;
            created_at: Date | null;
            name: string | null;
            bio: string | null;
            experience_years: number | null;
            verified: boolean | null;
            current_city: string | null;
            date_of_birth: Date | null;
            engagement_type: string | null;
            international_premium: import("@prisma/client-runtime-utils").Decimal | null;
            media_consent: boolean | null;
            music_experience_years: number | null;
            onboarding_completed: boolean | null;
            open_to_international: boolean | null;
            performance_experience_years: number | null;
            phone: string | null;
            pincode: string | null;
            teaching_experience_years: number | null;
            updated_at: Date | null;
            profile_picture: string | null;
            demo: boolean | null;
            tagline: string | null;
            teaching_style: string | null;
            education: string | null;
            professional_experience: string | null;
            youtube_links: string[];
        } | null;
    } & {
        id: string;
        role: string;
        is_active: boolean | null;
        created_at: Date | null;
        name: string | null;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map