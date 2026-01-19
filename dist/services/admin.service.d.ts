import { z } from 'zod';
import { teacherCompleteOnboardingSchema } from '../utils/validation';
type TeacherOnboardingInput = z.infer<typeof teacherCompleteOnboardingSchema>;
export declare class AdminService {
    static registerTeacher(adminId: string, data: TeacherOnboardingInput & {
        email: string;
        name: string;
    }): Promise<{
        credentials: {
            email: string;
            password: string;
        };
        teacher: {
            id: string;
            created_at: Date | null;
            name: string | null;
            bio: string | null;
            experience_years: number | null;
            verified: boolean | null;
            current_city: string | null;
            date_of_birth: Date | null;
            engagement_type: string | null;
            starting_price_inr: import("@prisma/client-runtime-utils").Decimal | null;
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
        };
    }>;
    static getDashboardStats(): Promise<{
        users: {
            total: number;
            teachers: number;
            students: number;
            recentSignups: number;
        };
        teachers: {
            total: number;
            verified: number;
            pending: number;
            verificationRate: number;
        };
        bookings: {
            total: number;
            completed: number;
            completionRate: number;
        };
        revenue: {
            total: number | import("@prisma/client-runtime-utils").Decimal;
        };
    }>;
    static getTeachers(params: {
        verified?: string;
        onboarding_completed?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        teachers: any[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    static updateTeacherVerification(teacherId: string, verified: boolean): Promise<{
        profiles: {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        };
    } & {
        id: string;
        created_at: Date | null;
        name: string | null;
        bio: string | null;
        experience_years: number | null;
        verified: boolean | null;
        current_city: string | null;
        date_of_birth: Date | null;
        engagement_type: string | null;
        starting_price_inr: import("@prisma/client-runtime-utils").Decimal | null;
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
    }>;
    static getTeacherDetails(teacherId: string): Promise<any>;
    static getUsers(params: {
        role?: string;
        is_active?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        users: ({
            users: {
                created_at: Date | null;
                email: string | null;
                last_sign_in_at: Date | null;
            };
            students: {
                id: string;
            } | null;
            teachers: {
                verified: boolean | null;
                onboarding_completed: boolean | null;
            } | null;
        } & {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    static updateUserStatus(userId: string, isActive: boolean): Promise<{
        id: string;
        role: string;
        is_active: boolean | null;
        created_at: Date | null;
        name: string | null;
    }>;
    static getAuditLogs(params: {
        page?: number;
        limit?: number;
    }): Promise<{
        logs: {
            id: string;
            created_at: Date | null;
            instance_id: string | null;
            payload: import("@prisma/client/runtime/client").JsonValue | null;
            ip_address: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
}
export {};
//# sourceMappingURL=admin.service.d.ts.map