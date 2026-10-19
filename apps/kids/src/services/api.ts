import { QuizDipPublicApi, QuizDipKidsDeviceApi, QuizDipKidsParentApi } from "@quizdip/api-client";

/**
 * QuizDip currently runs a single production backend.
 * Expo Go, simulators and release builds must all use the same HTTPS origin.
 * This public URL is not a credential; child tokens remain in OS SecureStore.
 * Change it deliberately in source if a separate environment is introduced.
 */
export const KIDS_API_ORIGIN = "https://quizdip.com";

export const publicApi = new QuizDipPublicApi(KIDS_API_ORIGIN);
export const kidsApi = new QuizDipKidsDeviceApi(KIDS_API_ORIGIN);
export const parentApi = new QuizDipKidsParentApi(KIDS_API_ORIGIN);
