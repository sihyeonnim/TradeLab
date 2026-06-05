import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware";
import {
  createInstructorCompetition,
  getCompetitionDetail,
  getCompetitionLeaderboard,
  getCurrentCompetition,
  joinCompetition,
  leaveCompetition,
  listAdminCompetitionParticipants,
  listAdminCompetitions,
  listCompetitions,
  listInstructorCompetitions,
  listInstructorCompetitionParticipants,
  listMyCompetitions,
} from "../controllers/competition.controller";

const router = Router();

router.get("/", requireAuth, listCompetitions);
router.get("/current", requireAuth, getCurrentCompetition);
router.get("/me", requireAuth, listMyCompetitions);

router.post("/instructor", requireAuth, createInstructorCompetition);
router.get("/instructor/me", requireAuth, listInstructorCompetitions);
router.get(
  "/instructor/:competitionId/participants",
  requireAuth,
  listInstructorCompetitionParticipants
);

router.get("/admin/all", requireAuth, listAdminCompetitions);
router.get(
  "/admin/:competitionId/participants",
  requireAuth,
  listAdminCompetitionParticipants
);

router.get("/:competitionId", requireAuth, getCompetitionDetail);
router.post("/:competitionId/join", requireAuth, joinCompetition);
router.delete("/:competitionId/join", requireAuth, leaveCompetition);
router.get(
  "/:competitionId/leaderboard",
  requireAuth,
  getCompetitionLeaderboard
);

export default router;