import type { $Enums } from '@prisma/client';
export type StudentLevel = $Enums.instrument_level;
export declare class PackageCardService {
    static getForStudent(studentId: string): Promise<{
        level: $Enums.instrument_level;
        points: string[];
        source: "override";
    } | {
        level: $Enums.instrument_level;
        points: string[] | null;
        source: "template" | "none";
    }>;
    static listTemplates(): Promise<{
        level: $Enums.instrument_level;
        updated_at: Date;
        points: string[];
    }[]>;
    static upsertTemplate(level: string, points: string[]): Promise<{
        level: $Enums.instrument_level;
        updated_at: Date;
        points: string[];
    }>;
    static updateStudentPackageCard(studentId: string, input: {
        level?: string;
        points?: string[];
        clearOverride?: boolean;
    }): Promise<{
        level: $Enums.instrument_level;
        points: string[];
        source: "override";
    } | {
        level: $Enums.instrument_level;
        points: string[] | null;
        source: "template" | "none";
    }>;
}
//# sourceMappingURL=package-card.service.d.ts.map