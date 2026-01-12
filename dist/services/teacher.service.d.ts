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
                date_of_birth: Date | null;
                updated_at: Date | null;
                gender: string | null;
                profile_picture_url: string | null;
                guardian_name: string | null;
                guardian_phone: string | null;
                signup_method: string;
                email_verified: boolean;
                onboarding_status: string;
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
        teacher_instruments: ({
            teacher_instrument_tiers: {
                level: import(".prisma/client").$Enums.instrument_level;
                id: string;
                created_at: Date;
                updated_at: Date;
                price_inr: import("@prisma/client-runtime-utils").Decimal;
                teacher_instrument_id: string;
                mode: import(".prisma/client").$Enums.class_mode;
                price_foreign: import("@prisma/client-runtime-utils").Decimal | null;
            }[];
        } & {
            id: string;
            created_at: Date;
            updated_at: Date;
            teach_or_perform: string;
            instrument: string;
            class_mode: import(".prisma/client").$Enums.class_mode | null;
            performance_fee_inr: import("@prisma/client-runtime-utils").Decimal | null;
            teacher_id: string;
            base_price: import("@prisma/client-runtime-utils").Decimal | null;
            performance_fee_foreign: import("@prisma/client-runtime-utils").Decimal | null;
        })[];
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
        teacher_instruments: ({
            teacher_instrument_tiers: {
                level: import(".prisma/client").$Enums.instrument_level;
                id: string;
                created_at: Date;
                updated_at: Date;
                price_inr: import("@prisma/client-runtime-utils").Decimal;
                teacher_instrument_id: string;
                mode: import(".prisma/client").$Enums.class_mode;
                price_foreign: import("@prisma/client-runtime-utils").Decimal | null;
            }[];
        } & {
            id: string;
            created_at: Date;
            updated_at: Date;
            teach_or_perform: string;
            instrument: string;
            class_mode: import(".prisma/client").$Enums.class_mode | null;
            performance_fee_inr: import("@prisma/client-runtime-utils").Decimal | null;
            teacher_id: string;
            base_price: import("@prisma/client-runtime-utils").Decimal | null;
            performance_fee_foreign: import("@prisma/client-runtime-utils").Decimal | null;
        })[];
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