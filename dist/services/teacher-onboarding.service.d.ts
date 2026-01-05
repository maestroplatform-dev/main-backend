import type { TeacherCompleteOnboardingInput } from '../utils/validation';
export declare class TeacherOnboardingService {
    static completeOnboarding(teacherId: string, data: TeacherCompleteOnboardingInput): Promise<{
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
    static getOnboardingData(teacherId: string): Promise<{
        teacher_languages: any;
        teacher_engagements: any;
        teacher_formats: any;
        teacher_instruments: any;
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
}
//# sourceMappingURL=teacher-onboarding.service.d.ts.map