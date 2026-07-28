export const BASE_URL = "https://academia.srmist.edu.in/";
export const LOGIN_URL = "https://academia.srmist.edu.in/accounts/signin.ac";

export const DEFAULT_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  origin: BASE_URL,
  referer: BASE_URL,
};

function academicYearUrl(semester: "ODD" | "EVEN"): string {
  const now = new Date();
  const year = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const next = year + 1;
  return `/srm_university/academia-academic-services/page/Academic_Planner_${year}_${String(next).slice(2)}_${semester}`;
}

export const URLS = {
  profile: "/srm_university/academia-academic-services/page/My_Time_Table_2023_24",
  attendance: "/srm_university/academia-academic-services/page/My_Attendance",
  gridBase: "/srm_university/academia-academic-services/page/Unified_Time_Table_2025",
  calendarOdd: academicYearUrl("ODD"),
  calendarEven: academicYearUrl("EVEN"),
} as const;
