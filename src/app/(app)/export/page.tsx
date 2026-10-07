import { redirect } from "next/navigation";

// The Export page was merged into the Download button on the Voters, Members and Families lists (Oct 2026).
// Old bookmarks land on the voter list.
export default function ExportPage() {
  redirect("/voters");
}
