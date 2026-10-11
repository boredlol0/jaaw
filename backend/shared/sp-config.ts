export const SP_BASE_URL = "https://sp.srmist.edu.in/srmiststudentportal";
export const SP_LOGIN_URL = `${SP_BASE_URL}/students/loginManager/youLogin.jsp`;
export const SP_LOGIN_SERVLET = `${SP_BASE_URL}/LoginServlet`;
export const SP_ATTENDANCE_URL = `${SP_BASE_URL}/students/report/studentAttendanceDetails.jsp`;
export const SP_MARKS_URL = `${SP_BASE_URL}/students/report/studentInternalMarkDetails.jsp`;
export const SP_INNER_MARKS_URL = `${SP_BASE_URL}/students/report/studentInternalMarkDetailsInner.jsp`;

export const SP_HOST = "sp.srmist.edu.in";

export const SP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

export const SP_HEADERS: Record<string, string> = {
  "user-agent": SP_USER_AGENT,
  referer: SP_LOGIN_URL,
  origin: "https://sp.srmist.edu.in",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

export const SP_NAV_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "sec-ch-ua": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};
