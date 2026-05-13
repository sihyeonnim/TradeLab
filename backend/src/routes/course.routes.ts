import express from "express";

import {
  listApprovedCourses,
  getCourseDetail,
  createInstructorCourse,
  listInstructorCourses,
  updateInstructorCourse,
  deleteInstructorCourse,
  createLesson,
  listCourseLessons,
  updateLesson,
  deleteLesson,
  listAdminCourses,
  listPendingCourses,
  approveCourse,
  rejectCourse,
  enrollInCourse,
  listMyEnrollments,
} from "../controllers/course.controller";

import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { videoUpload } from "../middleware/upload.middleware";

const router = express.Router();

router.get("/courses", requireAuth, listApprovedCourses);
router.get("/courses/:courseId", requireAuth, getCourseDetail);
router.get("/courses/:courseId/lessons", requireAuth, listCourseLessons);
router.post("/courses/:courseId/enroll", requireAuth, requireRole("USER"), enrollInCourse);
router.get("/enrollments/me", requireAuth, listMyEnrollments);

router.post(
  "/instructor/courses",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  createInstructorCourse
);

router.get(
  "/instructor/courses",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  listInstructorCourses
);

router.patch(
  "/instructor/courses/:courseId",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  updateInstructorCourse
);

router.delete(
  "/instructor/courses/:courseId",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  deleteInstructorCourse
);

router.post(
  "/instructor/courses/:courseId/lessons",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  videoUpload.single("video"),
  createLesson
);

router.patch(
  "/instructor/lessons/:lessonId",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  videoUpload.single("video"),
  updateLesson
);

router.delete(
  "/instructor/lessons/:lessonId",
  requireAuth,
  requireRole("INSTRUCTOR", "ADMIN"),
  deleteLesson
);

router.get(
  "/admin/courses",
  requireAuth,
  requireRole("ADMIN"),
  listAdminCourses
);

router.get(
  "/admin/courses/pending",
  requireAuth,
  requireRole("ADMIN"),
  listPendingCourses
);

router.patch(
  "/admin/courses/:courseId/approve",
  requireAuth,
  requireRole("ADMIN"),
  approveCourse
);

router.patch(
  "/admin/courses/:courseId/reject",
  requireAuth,
  requireRole("ADMIN"),
  rejectCourse
);

export default router;