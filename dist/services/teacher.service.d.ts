import { TeacherOnboardingInput, TeacherProfileUpdateInput } from '../utils/validation';
export declare class TeacherService {
    static onboard(teacherId: string, data: TeacherOnboardingInput): Promise<{
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
    }>;
    static getProfile(teacherId: string): Promise<{
        profiles: {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        };
        class_packages: {
            id: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string;
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
                    role: string;
                    is_active: boolean | null;
                    created_at: Date | null;
                    name: string | null;
                };
            } & {
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
        teacher_engagements: {
            id: string;
            created_at: Date;
            engagement_type: string;
            updated_at: Date;
            collaborative_projects: string[];
            collaborative_other: string | null;
            performance_fee_per_hour: import("@prisma/client-runtime-utils").Decimal | null;
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
            performance_settings: string[];
            performance_settings_other: string | null;
            other_contribution: string | null;
            teacher_id: string;
        } | null;
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
        teacher_languages: {
            id: string;
            created_at: Date;
            teacher_id: string;
            language: string;
        }[];
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
    static updateProfile(teacherId: string, data: TeacherProfileUpdateInput): Promise<{
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
    }>;
    static getAllTeachers(filters?: {
        verified?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<({
        profiles: {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        };
        class_packages: {
            id: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string;
            updated_at: Date | null;
            description: string | null;
            teacher_id: string;
            price: import("@prisma/client-runtime-utils").Decimal;
            classes_count: number;
            validity_days: number;
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
            performance_settings: string[];
            performance_settings_other: string | null;
            other_contribution: string | null;
            teacher_id: string;
        } | null;
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
        teacher_languages: {
            id: string;
            created_at: Date;
            teacher_id: string;
            language: string;
        }[];
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
    })[]>;
}
//# sourceMappingURL=teacher.service.d.ts.map