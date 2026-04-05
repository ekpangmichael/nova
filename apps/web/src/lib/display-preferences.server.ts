import { cookies } from "next/headers";
import {
  readDisplayPreferencesFromCookies,
  type DisplayPreferences,
} from "@/lib/display-preferences";

export async function getServerDisplayPreferences(): Promise<DisplayPreferences> {
  const cookieStore = await cookies();
  return readDisplayPreferencesFromCookies(cookieStore);
}
