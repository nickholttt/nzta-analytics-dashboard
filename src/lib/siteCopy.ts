// Words and addresses the public pages share, from config/site.json. Kept apart from site.ts, which holds the
// build switch, so a page that needs only the words does not read as depending on the switch.
import siteDoc from "../../config/site.json";

export const attribution: string = siteDoc.attribution;
export const issuesUrl: string = siteDoc.issues_url;
export const aboutCopy = siteDoc.about;

// The marker every unfilled gap on the About page carries, so one search finds them all.
export const PLACEHOLDER_MARK = "TO DECIDE";
