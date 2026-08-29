import { SolverInput } from "@chronos/solver";

export const FALLBACK_DATASET: Omit<SolverInput, "constraints"> = {
  courses: [
    { id: "c1", code: "303105218", name: "Design and Analysis of Algorithms", shortCode: "DAA", type: "LECTURE", weeklyHours: 3 },
    { id: "c2", code: "303105219", name: "Design and Analysis of Algorithms Lab", shortCode: "DAA-L", type: "LAB", weeklyHours: 2 },
    { id: "c3", code: "303105220", name: "Theory of Computation", shortCode: "TOC", type: "LECTURE", weeklyHours: 4 },
    { id: "c4", code: "303105221", name: "Software Engineering", shortCode: "SE", type: "LECTURE", weeklyHours: 3 },
    { id: "c5", code: "303105222", name: "Software Engineering Lab", shortCode: "SE-L", type: "LAB", weeklyHours: 2 },
    { id: "c6", code: "303105223", name: "Enterprise Programming", shortCode: "EP", type: "LECTURE", weeklyHours: 3 },
    { id: "c7", code: "303105224", name: "Enterprise Programming Lab", shortCode: "EP-L", type: "LAB", weeklyHours: 2 },
    { id: "c8", code: "303105225", name: "Professional Communication & Ethics", shortCode: "PCE", type: "LECTURE", weeklyHours: 1 },
    { id: "c9", code: "303105226", name: "Data Analytics & Data Visualization", shortCode: "DADV", type: "LECTURE", weeklyHours: 1 },
    { id: "c10", code: "303105227", name: "Data Analytics & Data Visualization Lab", shortCode: "DADV-L", type: "LAB", weeklyHours: 1 },
    { id: "c11", code: "303105228", name: "Applied Frameworks", shortCode: "AF", type: "LECTURE", weeklyHours: 1 },
  ],
  faculty: [
    { id: "f1", shortCode: "KR", fullName: "Prof. Karan Rathi", email: "karan.rathi@xyz.edu" },
    { id: "f2", shortCode: "MNM", fullName: "Prof. Mitesh M", email: "mitesh.m@xyz.edu" },
    { id: "f3", shortCode: "SS", fullName: "Prof. Sanjay S", email: "sanjay.s@xyz.edu" },
    { id: "f4", shortCode: "VKS", fullName: "Prof. Vijay K S", email: "vijay.s@xyz.edu" },
    { id: "f5", shortCode: "RPP", fullName: "Prof. Rajesh P P", email: "rajesh.p@xyz.edu" },
    { id: "f6", shortCode: "MBG", fullName: "Prof. Mukesh B G", email: "mukesh.g@xyz.edu" },
    { id: "f7", shortCode: "KRP", fullName: "Prof. Krunal R P", email: "krunal.p@xyz.edu" },
    { id: "f8", shortCode: "AJP", fullName: "Prof. Anjali J P", email: "anjali.p@xyz.edu" },
    { id: "f9", shortCode: "CPP", fullName: "Prof. Chetan P P", email: "chetan.p@xyz.edu" },
    { id: "f10", shortCode: "PDK", fullName: "Prof. Paresh D K", email: "paresh.k@xyz.edu" },
    { id: "f11", shortCode: "AP", fullName: "Prof. Alok P", email: "alok.p@xyz.edu" },
    { id: "f12", shortCode: "MS", fullName: "Prof. Manoj S", email: "manoj.s@xyz.edu" },
  ],
  facultyCourseAssignments: [
    { facultyId: "f1", courseId: "c1" }, // KR -> DAA
    { facultyId: "f2", courseId: "c2" }, // MNM -> DAA-L
    { facultyId: "f3", courseId: "c2" }, // SS -> DAA-L
    { facultyId: "f4", courseId: "c3" }, // VKS -> TOC
    { facultyId: "f5", courseId: "c4" }, // RPP -> SE
    { facultyId: "f5", courseId: "c5" }, // RPP -> SE-L
    { facultyId: "f6", courseId: "c6" }, // MBG -> EP
    { facultyId: "f7", courseId: "c7" }, // KRP -> EP-L
    { facultyId: "f8", courseId: "c8" }, // AJP -> PCE
    { facultyId: "f9", courseId: "c9" }, // CPP -> DADV
    { facultyId: "f9", courseId: "c10" }, // CPP -> DADV-L
    { facultyId: "f10", courseId: "c11" }, // PDK -> AF
    { facultyId: "f11", courseId: "c11" }, // AP -> AF
    { facultyId: "f12", courseId: "c4" }, // MS -> SE
    { facultyId: "f1", courseId: "c6" }, // KR -> EP
  ],
  rooms: [
    { id: "r1", roomNo: "372", type: "LECTURE_ROOM", capacity: 60 },
    { id: "r2", roomNo: "132", type: "LECTURE_ROOM", capacity: 60 },
    { id: "r3", roomNo: "302", type: "LAB", capacity: 30 },
    { id: "r4", roomNo: "134", type: "LAB", capacity: 30 },
  ],
  divisions: [
    { id: "d1", name: "5A15-1", semester: 5, program: "CSE" },
    { id: "d2", name: "5A15-2", semester: 5, program: "CSE" },
  ],
  timeSlots: [
    { id: "ts_mon_1", day: "MON", startTime: "07:30", endTime: "08:30", isBreak: false },
    { id: "ts_mon_2", day: "MON", startTime: "08:30", endTime: "09:30", isBreak: false },
    { id: "ts_mon_3", day: "MON", startTime: "09:30", endTime: "09:45", isBreak: true, breakLabel: "RECESS" },
    { id: "ts_mon_4", day: "MON", startTime: "09:45", endTime: "10:45", isBreak: false },
    { id: "ts_mon_5", day: "MON", startTime: "10:45", endTime: "11:45", isBreak: false },
    { id: "ts_mon_6", day: "MON", startTime: "11:45", endTime: "12:45", isBreak: true, breakLabel: "LUNCH" },
    { id: "ts_mon_7", day: "MON", startTime: "12:45", endTime: "13:35", isBreak: false },
    { id: "ts_mon_8", day: "MON", startTime: "13:35", endTime: "14:25", isBreak: false },

    { id: "ts_tue_1", day: "TUE", startTime: "07:30", endTime: "08:30", isBreak: false },
    { id: "ts_tue_2", day: "TUE", startTime: "08:30", endTime: "09:30", isBreak: false },
    { id: "ts_tue_3", day: "TUE", startTime: "09:30", endTime: "09:45", isBreak: true, breakLabel: "RECESS" },
    { id: "ts_tue_4", day: "TUE", startTime: "09:45", endTime: "10:45", isBreak: false },
    { id: "ts_tue_5", day: "TUE", startTime: "10:45", endTime: "11:45", isBreak: false },
    { id: "ts_tue_6", day: "TUE", startTime: "11:45", endTime: "12:45", isBreak: true, breakLabel: "LUNCH" },
    { id: "ts_tue_7", day: "TUE", startTime: "12:45", endTime: "13:35", isBreak: false },
    { id: "ts_tue_8", day: "TUE", startTime: "13:35", endTime: "14:25", isBreak: false },

    { id: "ts_wed_1", day: "WED", startTime: "07:30", endTime: "08:30", isBreak: false },
    { id: "ts_wed_2", day: "WED", startTime: "08:30", endTime: "09:30", isBreak: false },
    { id: "ts_wed_3", day: "WED", startTime: "09:30", endTime: "09:45", isBreak: true, breakLabel: "RECESS" },
    { id: "ts_wed_4", day: "WED", startTime: "09:45", endTime: "10:45", isBreak: false },
    { id: "ts_wed_5", day: "WED", startTime: "10:45", endTime: "11:45", isBreak: false },
    { id: "ts_wed_6", day: "WED", startTime: "11:45", endTime: "12:45", isBreak: true, breakLabel: "LUNCH" },
    { id: "ts_wed_7", day: "WED", startTime: "12:45", endTime: "13:35", isBreak: false },
    { id: "ts_wed_8", day: "WED", startTime: "13:35", endTime: "14:25", isBreak: false },

    { id: "ts_thu_1", day: "THU", startTime: "07:30", endTime: "08:30", isBreak: false },
    { id: "ts_thu_2", day: "THU", startTime: "08:30", endTime: "09:30", isBreak: false },
    { id: "ts_thu_3", day: "THU", startTime: "09:30", endTime: "09:45", isBreak: true, breakLabel: "RECESS" },
    { id: "ts_thu_4", day: "THU", startTime: "09:45", endTime: "10:45", isBreak: false },
    { id: "ts_thu_5", day: "THU", startTime: "10:45", endTime: "11:45", isBreak: false },
    { id: "ts_thu_6", day: "THU", startTime: "11:45", endTime: "12:45", isBreak: true, breakLabel: "LUNCH" },
    { id: "ts_thu_7", day: "THU", startTime: "12:45", endTime: "13:35", isBreak: false },
    { id: "ts_thu_8", day: "THU", startTime: "13:35", endTime: "14:25", isBreak: false },

    { id: "ts_fri_1", day: "FRI", startTime: "07:30", endTime: "08:30", isBreak: false },
    { id: "ts_fri_2", day: "FRI", startTime: "08:30", endTime: "09:30", isBreak: false },
    { id: "ts_fri_3", day: "FRI", startTime: "09:30", endTime: "09:45", isBreak: true, breakLabel: "RECESS" },
    { id: "ts_fri_4", day: "FRI", startTime: "09:45", endTime: "10:45", isBreak: false },
    { id: "ts_fri_5", day: "FRI", startTime: "10:45", endTime: "11:45", isBreak: false },
    { id: "ts_fri_6", day: "FRI", startTime: "11:45", endTime: "12:45", isBreak: true, breakLabel: "LUNCH" },
    { id: "ts_fri_7", day: "FRI", startTime: "12:45", endTime: "13:35", isBreak: false },
    { id: "ts_fri_8", day: "FRI", startTime: "13:35", endTime: "14:25", isBreak: false },

    { id: "ts_sat_1", day: "SAT", startTime: "07:30", endTime: "08:30", isBreak: false },
    { id: "ts_sat_2", day: "SAT", startTime: "08:30", endTime: "09:30", isBreak: false },
    { id: "ts_sat_3", day: "SAT", startTime: "09:30", endTime: "09:45", isBreak: true, breakLabel: "RECESS" },
    { id: "ts_sat_4", day: "SAT", startTime: "09:45", endTime: "10:45", isBreak: false },
    { id: "ts_sat_5", day: "SAT", startTime: "10:45", endTime: "11:45", isBreak: false },
    { id: "ts_sat_6", day: "SAT", startTime: "11:45", endTime: "12:45", isBreak: true, breakLabel: "LUNCH" },
    { id: "ts_sat_7", day: "SAT", startTime: "12:45", endTime: "13:35", isBreak: false },
    { id: "ts_sat_8", day: "SAT", startTime: "13:35", endTime: "14:25", isBreak: false },
  ],
};
