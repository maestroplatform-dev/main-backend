import { TeacherOnboardingInput, TeacherProfileUpdateInput } from '../utils/validation';
export declare class TeacherService {
    static onboard(teacherId: string, data: TeacherOnboardingInput): Promise<{
        id: string;
        created_at: Date | null;
        bio: string | null;
        experience_years: number | null;
        verified: boolean | null;
    }>;
    static getProfile(teacherId: string): Promise<{
        profiles: {
            id: string;
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
        };
        class_packages: {
            id: string;
            name: string;
            is_active: boolean | null;
            created_at: Date | null;
            teacher_id: string;
            description: string | null;
            price: import("@prisma/client-runtime-utils").Decimal;
            classes_count: number;
            validity_days: number;
            updated_at: Date | null;
        }[];
        reviews: ({
            students: {
                profiles: {
                    id: string;
                    name: string | null;
                    role: string;
                    is_active: boolean | null;
                    created_at: Date | null;
                };
            } & {
                id: string;
                created_at: Date | null;
            };
        } & {
            id: string;
            created_at: Date | null;
            teacher_id: string;
            student_id: string;
            booking_id: string | null;
            rating: number;
            comment: string | null;
        })[];
    } & {
        id: string;
        created_at: Date | null;
        bio: string | null;
        experience_years: number | null;
        verified: boolean | null;
    }>;
    static updateProfile(teacherId: string, data: TeacherProfileUpdateInput): Promise<{
        id: string;
        created_at: Date | null;
        bio: string | null;
        experience_years: number | null;
        verified: boolean | null;
    }>;
    static getAllTeachers(filters?: {
        verified?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<({
        profiles: {
            id: string;
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
        };
        class_packages: {
            id: string;
            name: string;
            is_active: boolean | null;
            created_at: Date | null;
            teacher_id: string;
            description: string | null;
            price: import("@prisma/client-runtime-utils").Decimal;
            classes_count: number;
            validity_days: number;
            updated_at: Date | null;
        }[];
    } & {
        id: string;
        created_at: Date | null;
        bio: string | null;
        experience_years: number | null;
        verified: boolean | null;
    })[]>;
}
//# sourceMappingURL=teacher.service.d.ts.map