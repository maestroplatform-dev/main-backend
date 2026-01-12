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
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
        };
        student: {
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
    }>;
    /**
     * Complete Google OAuth signup - update user with profile info
     */
    static completeGoogleSignup(data: GoogleProfileData): Promise<{
        user: import("@supabase/auth-js").User;
        profile: {
            id: string;
            name: string | null;
            role: string;
            is_active: boolean | null;
            created_at: Date | null;
        };
        student: {
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
    }>;
    /**
     * Get student profile
     */
    static getStudentProfile(userId: string): Promise<{
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
    }>;
    /**
     * Update profile picture
     */
    static updateProfilePicture(userId: string, pictureUrl: string): Promise<{
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
    }>;
    /**
     * Get student by email
     */
    static getStudentByEmail(email: string): Promise<{
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
    } | null>;
    /**
     * Update student onboarding status
     */
    static updateOnboardingStatus(userId: string, status: string): Promise<{
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
    }>;
}
export {};
//# sourceMappingURL=student.service.d.ts.map