"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeacherOnboardingService = void 0;
const database_1 = __importDefault(require("../config/database"));
const types_1 = require("../types");
class TeacherOnboardingService {
    // Complete onboarding 
    static async completeOnboarding(teacherId, data) {
        const teacher = await database_1.default.teachers.findUnique({
            where: { id: teacherId },
        });
        if (!teacher) {
            throw new types_1.AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND');
        }
        try {
            const updatedTeacher = await database_1.default.$transaction(async (tx) => {
                // Update basic info on teacher
                const teacherRow = await tx.teachers.update({
                    where: { id: teacherId },
                    data: {
                        phone: data.phone,
                        date_of_birth: new Date(data.date_of_birth),
                        music_experience_years: data.music_experience_years,
                        teaching_experience_years: data.teaching_experience_years,
                        performance_experience_years: data.performance_experience_years,
                        current_city: data.current_city,
                        pincode: data.pincode,
                        media_consent: data.media_consent,
                        profile_picture: data.profile_picture,
                        demo: data.demo,
                        tagline: data.tagline,
                        bio: data.bio,
                        teaching_style: data.teaching_style,
                        education: data.education,
                        professional_experience: data.professional_experience,
                        youtube_links: data.youtube_links,
                        engagement_type: data.engagement_type,
                        starting_price_inr: data.starting_price_inr ?? null,
                        open_to_international: data.open_to_international,
                        international_premium: data.open_to_international ? data.international_premium : 0,
                        onboarding_completed: true,
                    },
                });
                // Languages
                await tx.teacher_languages.deleteMany({ where: { teacher_id: teacherId } });
                if (data.languages.length > 0) {
                    await tx.teacher_languages.createMany({
                        data: data.languages.map((lang) => ({ teacher_id: teacherId, language: lang })),
                    });
                }
                // Engagement preferences
                await tx.teacher_engagements.upsert({
                    where: { teacher_id: teacherId },
                    create: {
                        teacher_id: teacherId,
                        engagement_type: data.engagement_type,
                        collaborative_projects: data.collaborative_projects,
                        collaborative_other: data.collaborative_other,
                        performance_fee_per_hour: data.performance_fee_per_hour,
                    },
                    update: {
                        engagement_type: data.engagement_type,
                        collaborative_projects: data.collaborative_projects,
                        collaborative_other: data.collaborative_other,
                        performance_fee_per_hour: data.performance_fee_per_hour,
                    },
                });
                // Teaching formats
                await tx.teacher_formats.upsert({
                    where: { teacher_id: teacherId },
                    create: {
                        teacher_id: teacherId,
                        class_formats: data.class_formats,
                        class_formats_other: data.class_formats_other,
                        exam_training: data.exam_training,
                        exam_training_other: data.exam_training_other,
                        additional_formats: data.additional_formats,
                        additional_formats_other: data.additional_formats_other,
                        learner_groups: data.learner_groups,
                        learner_groups_other: data.learner_groups_other,
                        performance_settings: data.performance_settings,
                        performance_settings_other: data.performance_settings_other,
                        other_contribution: data.other_contribution,
                    },
                    update: {
                        class_formats: data.class_formats,
                        class_formats_other: data.class_formats_other,
                        exam_training: data.exam_training,
                        exam_training_other: data.exam_training_other,
                        additional_formats: data.additional_formats,
                        additional_formats_other: data.additional_formats_other,
                        learner_groups: data.learner_groups,
                        learner_groups_other: data.learner_groups_other,
                        performance_settings: data.performance_settings,
                        performance_settings_other: data.performance_settings_other,
                        other_contribution: data.other_contribution,
                    },
                });
                // Remove existing instruments and tiers
                const existingInstruments = await tx.teacher_instruments.findMany({
                    where: { teacher_id: teacherId },
                    select: { id: true },
                });
                const existingIds = existingInstruments.map((i) => i.id);
                if (existingIds.length > 0) {
                    await tx.teacher_instrument_tiers.deleteMany({ where: { teacher_instrument_id: { in: existingIds } } });
                }
                await tx.teacher_instruments.deleteMany({ where: { teacher_id: teacherId } });
                // Insert instruments and tiers
                for (const inst of data.instruments) {
                    if (inst.teach_or_perform === 'Teach') {
                        const instrumentRow = await tx.teacher_instruments.create({
                            data: {
                                teacher_id: teacherId,
                                instrument: inst.instrument,
                                teach_or_perform: inst.teach_or_perform,
                                class_mode: inst.class_mode,
                                base_price: null,
                                one_on_one_price_inr: inst.one_on_one_price_inr ?? null,
                                performance_fee_inr: null,
                                performance_fee_foreign: null,
                                package_card_points: inst.package_card_points || null,
                            },
                        });
                        const tiers = (inst.tiers || []).map((tier) => {
                            const priceForeign = data.open_to_international && data.international_premium
                                ? tier.price_inr + data.international_premium
                                : null;
                            return {
                                teacher_instrument_id: instrumentRow.id,
                                level: tier.level,
                                mode: inst.class_mode,
                                // Teacher's net price and optional platform markup
                                price_inr: tier.price_inr,
                                platform_markup_inr: tier.platform_markup_inr ?? null,
                                price_foreign: priceForeign,
                            };
                        });
                        if (tiers.length > 0) {
                            await tx.teacher_instrument_tiers.createMany({ data: tiers });
                        }
                    }
                    else {
                        await tx.teacher_instruments.create({
                            data: {
                                teacher_id: teacherId,
                                instrument: inst.instrument,
                                teach_or_perform: inst.teach_or_perform,
                                class_mode: null,
                                base_price: null,
                                one_on_one_price_inr: inst.one_on_one_price_inr ?? null,
                                // Teacher performance fee and optional platform markup
                                performance_fee_inr: inst.performance_fee_inr,
                                performance_platform_markup_inr: inst.platform_markup_inr ?? null,
                                performance_fee_foreign: data.open_to_international && data.international_premium
                                    ? inst.performance_fee_inr + data.international_premium
                                    : null,
                                // Removed open_to_international and international_premium
                                package_card_points: inst.package_card_points || null,
                            },
                        });
                    }
                }
                return teacherRow;
            });
            return updatedTeacher;
        }
        catch (error) {
            if (error instanceof types_1.AppError) {
                throw error;
            }
            throw new types_1.AppError(500, 'Failed to complete onboarding', 'ONBOARDING_FAILED');
        }
    }
    // Get full onboarding data
    static async getOnboardingData(teacherId) {
        const teacher = await database_1.default.teachers.findUnique({
            where: { id: teacherId },
        });
        if (!teacher) {
            throw new types_1.AppError(404, 'Teacher not found', 'TEACHER_NOT_FOUND');
        }
        // Fetch related data separately
        const languages = await database_1.default.teacher_languages.findMany({
            where: { teacher_id: teacherId },
        });
        const engagements = await database_1.default.teacher_engagements.findUnique({
            where: { teacher_id: teacherId },
        });
        const formats = await database_1.default.teacher_formats.findUnique({
            where: { teacher_id: teacherId },
        });
        const instruments = await database_1.default.teacher_instruments.findMany({
            where: { teacher_id: teacherId },
            include: {
                teacher_instrument_tiers: true,
            },
        });
        const normalize = (raw) => {
            if (!raw)
                return null;
            const levels = ['beginner', 'intermediate', 'advanced'];
            const sessions = ['10', '20', '30'];
            const out = {};
            for (const level of levels) {
                const val = raw[level];
                if (!val) {
                    out[level] = { '10': ['', '', '', ''], '20': ['', '', '', ''], '30': ['', '', '', ''] };
                }
                else if (Array.isArray(val)) {
                    out[level] = { '10': val, '20': val, '30': val };
                }
                else {
                    out[level] = {
                        '10': val['10'] || ['', '', '', ''],
                        '20': val['20'] || ['', '', '', ''],
                        '30': val['30'] || ['', '', '', ''],
                    };
                }
            }
            return out;
        };
        const normalizedInstruments = instruments.map((inst) => ({
            ...inst,
            package_card_points: normalize(inst.package_card_points),
        }));
        return {
            ...teacher,
            teacher_languages: languages,
            teacher_engagements: engagements,
            teacher_formats: formats,
            teacher_instruments: normalizedInstruments,
        };
    }
}
exports.TeacherOnboardingService = TeacherOnboardingService;
//# sourceMappingURL=teacher-onboarding.service.js.map