import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware";
import {
  approveAdminCourse,
  getAdminCompetitionParticipants,
  getAdminCompetitionsOverview,
  getAdminCourseEnrollments,
  getAdminCoursesOverview,
  getAdminUserDetail,
  listAdminUsers,
  rejectAdminCourse,
} from "../controllers/admin.controller";

const router = Router();

router.get("/users", requireAuth, listAdminUsers);
router.get("/users/:userId", requireAuth, getAdminUserDetail);

router.get("/courses/overview", requireAuth, getAdminCoursesOverview);
router.get(
  "/courses/:courseId/enrollments",
  requireAuth,
  getAdminCourseEnrollments
);
router.patch("/courses/:courseId/approve", requireAuth, approveAdminCourse);
router.patch("/courses/:courseId/reject", requireAuth, rejectAdminCourse);

router.get("/competitions/overview", requireAuth, getAdminCompetitionsOverview);
router.get(
  "/competitions/:competitionId/participants",
  requireAuth,
  getAdminCompetitionParticipants
);

export default router;
