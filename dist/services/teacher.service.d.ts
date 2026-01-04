import { TeacherOnboardingInput, TeacherProfileUpdateInput } from '../utils/validation';
export declare class TeacherService {
    static onboard(teacherId: string, data: TeacherOnboardingInput): Promise<{
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
            updated_at: Date | null;
            description: string | null;
            teacher_id: string;
            price: import("@prisma/client-runtime-utils").Decimal;
            classes_count: number;
            validity_days: number;
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
                name: string | null;
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
        teacher_languages: {
            id: string;
            created_at: Date;
            teacher_id: string;
            language: string;
        }[];
        teacher_instruments: {
            id: string;
            created_at: Date;
            updated_at: Date;
            instrument: string;
            teach_or_perform: string;
            base_price: import("@prisma/client-runtime-utils").Decimal | null;
            teacher_id: string;
        }[];
        teacher_engagements: {
            id: string;
            created_at: Date;
            engagement_type: string;
            updated_at: Date;
            collaborative_projects: string[];
            collaborative_other: string | null;
            teacher_id: string;
        } | null;
        teacher_formats: {
            id: string;
            created_at: Date;
            updated_at: Date;
            class_formats: string[];
            class_formats_other: string | null;
            exam_training: string[];
            exam_training_other: string | null;
            additional_formats: string[];
            additional_formats_other: string | null;
            learner_groups: string[];
            learner_groups_other: string | null;
            other_contribution: string | null;
            teacher_id: string;
        } | null;
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
        international_premium: import("@prisma/client-runtime-utils").Decimal | null;
        open_to_international: boolean | null;
        onboarding_completed: boolean | null;
        verified: boolean | null;
        updated_at: Date | null;
    }>;
    static updateProfile(teacherId: string, data: TeacherProfileUpdateInput): Promise<{
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
            updated_at: Date | null;
            description: string | null;
            teacher_id: string;
            price: import("@prisma/client-runtime-utils").Decimal;
            classes_count: number;
            validity_days: number;
        }[];
        teacher_languages: {
            id: string;
            created_at: Date;
            teacher_id: string;
            language: string;
        }[];
        teacher_instruments: {
            id: string;
            created_at: Date;
            updated_at: Date;
            instrument: string;
            teach_or_perform: string;
            base_price: import("@prisma/client-runtime-utils").Decimal | null;
            teacher_id: string;
        }[];
        teacher_formats: {
            id: string;
            created_at: Date;
            updated_at: Date;
            class_formats: string[];
            class_formats_other: string | null;
            exam_training: string[];
            exam_training_other: string | null;
            additional_formats: string[];
            additional_formats_other: string | null;
            learner_groups: string[];
            learner_groups_other: string | null;
            other_contribution: string | null;
            teacher_id: string;
        } | null;
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
        international_premium: import("@prisma/client-runtime-utils").Decimal | null;
        open_to_international: boolean | null;
        onboarding_completed: boolean | null;
        verified: boolean | null;
        updated_at: Date | null;
    })[]>;
}
//# sourceMappingURL=teacher.service.d.ts.map