import { redirect } from "next/navigation";

/**
 * The Imperium mentor experience lives at /mentor (the tab the bottom nav and
 * the home bento card both point at). This legacy path just forwards there so
 * any old link or bookmark lands on the real chat instead of a dead placeholder.
 */
export default function ImperiumPage() {
  redirect("/mentor");
}
