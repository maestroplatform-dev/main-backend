import { AdminRegisterTeacherInput } from '../utils/validation';
import { Prisma } from '@prisma/client';
export declare class AdminService {
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
            total: number | Prisma.Decimal;
        };
    }>;
    static getTeachers(params: {
        verified?: string;
        onboarding_completed?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        teachers: {
            avgRating: number;
            profiles: {
                name: string | null;
                is_active: boolean | null;
                created_at: Date | null;
            };
            reviews: {
                rating: number;
            }[];
            teacher_instruments: {
                instrument: string;
                teach_or_perform: string;
                base_price: Prisma.Decimal | null;
            }[];
            teacher_formats: {
                class_formats: string[];
            } | null;
            _count: {
                bookings: number;
                reviews: number;
            };
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
            international_premium: Prisma.Decimal | null;
            open_to_international: boolean | null;
            onboarding_completed: boolean | null;
            verified: boolean | null;
            updated_at: Date | null;
        }[];
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
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
        };
    } & {
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
        international_premium: Prisma.Decimal | null;
        open_to_international: boolean | null;
        onboarding_completed: boolean | null;
        verified: boolean | null;
        updated_at: Date | null;
    }>;
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
                onboarding_completed: boolean | null;
                verified: boolean | null;
            } | null;
        } & {
            id: string;
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
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
        name: string | null;
        role: string;
        is_active: boolean | null;
        created_at: Date | null;
    }>;
    static getAuditLogs(params: {
        page?: number;
        limit?: number;
    }): Promise<{
        logs: {
            id: string;
            created_at: Date | null;
            instance_id: string | null;
            payload: Prisma.JsonValue | null;
            ip_address: string;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    static registerTeacher(data: AdminRegisterTeacherInput): Promise<{
        profile: {
            id: string;
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
        };
        teacher: {
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
            international_premium: Prisma.Decimal | null;
            open_to_international: boolean | null;
            onboarding_completed: boolean | null;
            verified: boolean | null;
            updated_at: Date | null;
        };
        credentials: {
            email: string;
            password: string;
        };
    }>;
}
//# sourceMappingURL=admin.service.d.ts.map