interface StudentSignupData {
    email: string;
    name: string;
    gender: string;
    dob: Date;
    password: string;
    guardianName?: string;
    guardianPhone?: string;
}
interface GoogleProfileData {
    userId: string;
    dob: Date;
    gender: string;
    googlePictureUrl?: string;
    guardianName?: string;
    guardianPhone?: string;
}
export declare class StudentService {
    /**
     * Calculate age from date of birth
     */
    static calculateAge(dob: Date): number;
    /**
     * Check if student requires guardian info based on age
     */
    static requiresGuardian(dob: Date): boolean;
    /**
     * Complete email signup - create user and student profile
     */
    static completeEmailSignup(data: StudentSignupData): Promise<{
        user: import("@supabase/auth-js").User;
        profile: {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        };
        student: {
            level: import(".prisma/client").$Enums.instrument_level;
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
    }>;
    /**
     * Complete Google OAuth signup - update user with profile info
     */
    static completeGoogleSignup(data: GoogleProfileData): Promise<{
        user: import("@supabase/auth-js").User;
        profile: {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        };
        student: {
            level: import(".prisma/client").$Enums.instrument_level;
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
    }>;
    /**
     * Get student profile
     */
    static getStudentProfile(userId: string): Promise<{
        profiles: {
            id: string;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
            name: string | null;
        };
    } & {
        level: import(".prisma/client").$Enums.instrument_level;
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
    }>;
    /**
     * Update profile picture
     */
    static updateProfilePicture(userId: string, pictureUrl: string): Promise<{
        level: import(".prisma/client").$Enums.instrument_level;
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
    }>;
    /**
     * Get student by email
     */
    static getStudentByEmail(email: string): Promise<{
        level: import(".prisma/client").$Enums.instrument_level;
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
    } | null>;
    /**
     * Update student onboarding status
     */
    static updateOnboardingStatus(userId: string, status: string): Promise<{
        level: import(".prisma/client").$Enums.instrument_level;
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
    }>;
}
export {};
//# sourceMappingURL=student.service.d.ts.map