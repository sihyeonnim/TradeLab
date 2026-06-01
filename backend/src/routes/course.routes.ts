import express from "express";

import {
  createCourse,
  updateCourse,
  submitCourseForApproval,
  getMyCourses,
  browseCourses,
  getCourseDetail,
  enrollInCourse,
  getMyEnrollments,
  listPendingCourses,
  reviewCourse,
} from "../controllers/course.controller";

import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { UserRole } from "../models";

const router = express.Router();

// All course routes require authentication.
router.use(requireAuth);

// --- Instructor: course authoring (REQ-COURSE-01/02) ---
router.post("/courses", requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN), createCourse);
router.get("/courses/mine", requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN), getMyCourses);

// --- Admin: approval workflow (declare before /courses/:courseId) ---
router.get("/admin/courses/pending", requireRole(UserRole.ADMIN), listPendingCourses);
router.post("/admin/courses/:courseId/review", requireRole(UserRole.ADMIN), reviewCourse);

// --- Student: browse & enroll (REQ-COURSE-03) ---
router.get("/courses/browse", browseCourses);
router.get("/enrollments/me", getMyEnrollments);

// --- Course-scoped routes (dynamic :courseId comes after static paths) ---
router.patch("/courses/:courseId", requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN), updateCourse);
router.post(
  "/courses/:courseId/submit",
  requireRole(UserRole.INSTRUCTOR, UserRole.ADMIN),
  submitCourseForApproval
);
router.get("/courses/:courseId", getCourseDetail);
router.post("/courses/:courseId/enroll", enrollInCourse);

export default router;
