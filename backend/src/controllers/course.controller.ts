import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import {
  Course,
  CourseLevel,
  CourseApprovalStatus,
  Lesson,
  Enrollment,
  EnrollmentStatus,
  User,
  UserRole,
} from "../models";

function getCurrentUser(req: Request): any {
  return (req as any).user;
}

function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeLevel(value: unknown): CourseLevel {
  const normalized = String(value || "").trim().toUpperCase();
  if ((Object.values(CourseLevel) as string[]).includes(normalized)) {
    return normalized as CourseLevel;
  }
  return CourseLevel.BEGINNER;
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function normalizeInstructor(instructor: any) {
  if (!instructor || typeof instructor !== "object") {
    return null;
  }
  return {
    id: String(instructor._id),
    name: instructor.name,
    email: instructor.email,
    role: instructor.role,
  };
}

function normalizeCourse(course: any, extra: Record<string, unknown> = {}) {
  return {
    id: String(course._id),
    title: course.title,
    description: course.description,
    level: course.level,
    price: toNumber(course.price, 0),
    tags: course.tags ?? [],
    approvalStatus: course.approvalStatus,
    isPublished: Boolean(course.isPublished),
    rejectionReason: course.rejectionReason ?? null,
    instructor: normalizeInstructor(course.instructor),
    createdAt: course.createdAt,
    ...extra,
  };
}

function normalizeLesson(lesson: any, opts: { includeContent: boolean }) {
  const base = {
    id: String(lesson._id),
    course: String(lesson.course),
    title: lesson.title,
    order: lesson.order,
    summary: lesson.summary ?? null,
    durationSeconds: lesson.video?.durationSeconds ?? null,
  };

  if (!opts.includeContent) {
    return base;
  }

  return {
    ...base,
    video: lesson.video ?? null,
    contentMarkdown: lesson.contentMarkdown ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * REQ-COURSE-01 / 02 — Instructor course creation
 * ------------------------------------------------------------------ */

export async function createCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const { title, description } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "title is required." });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ message: "description is required." });
    }

    const course: any = await Course.create({
      title: String(title).trim(),
      description: String(description).trim(),
      instructor: user._id,
      level: normalizeLevel(req.body.level),
      price: Math.max(0, toNumber(req.body.price, 0)),
      tags: normalizeTags(req.body.tags),
      approvalStatus: CourseApprovalStatus.DRAFT,
      isPublished: false,
    });

    // Optionally create the initial lesson structure in one call.
    const lessonsInput = Array.isArray(req.body.lessons) ? req.body.lessons : [];
    if (lessonsInput.length > 0) {
      await Lesson.insertMany(
        lessonsInput.map((lesson: any, index: number) => ({
          course: course._id,
          title: String(lesson.title || `Lesson ${index + 1}`).trim(),
          order: toNumber(lesson.order, index + 1),
          summary: lesson.summary ? String(lesson.summary).trim() : undefined,
          video: {
            provider: lesson.video?.provider || "DUMMY",
            path: lesson.video?.path || "dummy://pending",
            durationSeconds: toNumber(lesson.video?.durationSeconds, 0),
          },
          contentMarkdown: lesson.contentMarkdown || undefined,
        }))
      );
    }

    return res.status(201).json({
      message: "Course created.",
      course: normalizeCourse(course),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const courseId = String(req.params.courseId || "");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid courseId." });
    }

    const course: any = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    // Only the owning instructor (or an admin) may edit.
    if (
      String(course.instructor) !== String(user._id) &&
      user.role !== UserRole.ADMIN
    ) {
      return res.status(403).json({ message: "Not your course." });
    }

    if (req.body.title !== undefined) course.title = String(req.body.title).trim();
    if (req.body.description !== undefined)
      course.description = String(req.body.description).trim();
    if (req.body.level !== undefined) course.level = normalizeLevel(req.body.level);
    if (req.body.price !== undefined)
      course.price = Math.max(0, toNumber(req.body.price, 0));
    if (req.body.tags !== undefined) course.tags = normalizeTags(req.body.tags);

    await course.save();

    return res.json({
      message: "Course updated.",
      course: normalizeCourse(course),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Instructor submits a DRAFT/REJECTED course for admin review.
 */
export async function submitCourseForApproval(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const courseId = String(req.params.courseId || "");

    const course: any = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }
    if (String(course.instructor) !== String(user._id)) {
      return res.status(403).json({ message: "Not your course." });
    }

    course.approvalStatus = CourseApprovalStatus.PENDING_APPROVAL;
    course.rejectionReason = undefined;
    await course.save();

    return res.json({
      message: "Course submitted for approval.",
      course: normalizeCourse(course),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Courses owned by the current instructor (any status).
 */
export async function getMyCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const courses: any[] = await Course.find({ instructor: user._id })
      .populate("instructor", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const counts = await Lesson.aggregate([
      { $match: { course: { $in: courses.map((c) => c._id) } } },
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.count]));

    return res.json({
      courses: courses.map((course) =>
        normalizeCourse(course, {
          lessonCount: countMap.get(String(course._id)) ?? 0,
        })
      ),
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ *
 * REQ-COURSE-03 — Browse & enroll
 * ------------------------------------------------------------------ */

/**
 * Public catalog: only APPROVED + published courses. Supports ?search= & ?level=.
 */
export async function browseCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);

    const filter: any = {
      approvalStatus: CourseApprovalStatus.APPROVED,
      isPublished: true,
    };

    const search = String(req.query.search || "").trim();
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const level = String(req.query.level || "").trim().toUpperCase();
    if ((Object.values(CourseLevel) as string[]).includes(level)) {
      filter.level = level;
    }

    const courses: any[] = await Course.find(filter)
      .populate("instructor", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const courseIds = courses.map((c) => c._id);

    const counts = await Lesson.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: "$course", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.count]));

    const myEnrollments: any[] = await Enrollment.find({
      user: user._id,
      course: { $in: courseIds },
    }).lean();
    const enrollMap = new Map(
      myEnrollments.map((e: any) => [String(e.course), e])
    );

    return res.json({
      courses: courses.map((course) => {
        const enrollment = enrollMap.get(String(course._id));
        return normalizeCourse(course, {
          lessonCount: countMap.get(String(course._id)) ?? 0,
          isEnrolled: Boolean(enrollment),
          progressPercent: enrollment
            ? toNumber(enrollment.progressPercent, 0)
            : 0,
        });
      }),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Course detail. Lesson *content* is only included for enrolled users, the
 * owning instructor, or an admin (REQ-COURSE-04). Everyone else sees the lesson
 * list (titles/order) as a preview.
 */
export async function getCourseDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const courseId = String(req.params.courseId || "");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid courseId." });
    }

    const course: any = await Course.findById(courseId)
      .populate("instructor", "name email role")
      .lean();

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const isOwner = String(course.instructor?._id) === String(user._id);
    const isAdmin = user.role === UserRole.ADMIN;

    // Non-approved courses are only visible to the owner/admin.
    if (
      course.approvalStatus !== CourseApprovalStatus.APPROVED &&
      !isOwner &&
      !isAdmin
    ) {
      return res.status(403).json({ message: "Course is not available." });
    }

    const enrollment: any = await Enrollment.findOne({
      user: user._id,
      course: course._id,
    }).lean();

    const hasAccess = Boolean(enrollment) || isOwner || isAdmin;

    const lessons: any[] = await Lesson.find({ course: course._id })
      .sort({ order: 1 })
      .lean();

    return res.json({
      course: normalizeCourse(course, {
        isEnrolled: Boolean(enrollment),
        hasContentAccess: hasAccess,
        progressPercent: enrollment
          ? toNumber(enrollment.progressPercent, 0)
          : 0,
        completedLessons: enrollment
          ? (enrollment.completedLessons || []).map((id: any) => String(id))
          : [],
      }),
      lessons: lessons.map((lesson) =>
        normalizeLesson(lesson, { includeContent: hasAccess })
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function enrollInCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const courseId = String(req.params.courseId || "");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid courseId." });
    }

    const course: any = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (
      course.approvalStatus !== CourseApprovalStatus.APPROVED ||
      !course.isPublished
    ) {
      return res
        .status(400)
        .json({ message: "Course is not open for enrollment." });
    }

    const existing = await Enrollment.findOne({
      user: user._id,
      course: course._id,
    });
    if (existing) {
      return res.status(200).json({ message: "Already enrolled." });
    }

    await Enrollment.create({
      user: user._id,
      course: course._id,
      status: EnrollmentStatus.ACTIVE,
      progressPercent: 0,
      completedLessons: [],
    });

    return res.status(201).json({ message: "Enrolled successfully." });
  } catch (error) {
    next(error);
  }
}

/**
 * The current user's enrollments with course + progress info.
 */
export async function getMyEnrollments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);

    const enrollments: any[] = await Enrollment.find({ user: user._id })
      .populate({
        path: "course",
        populate: { path: "instructor", select: "name email role" },
      })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      enrollments: enrollments
        .filter((e: any) => e.course)
        .map((enrollment: any) => ({
          id: String(enrollment._id),
          status: enrollment.status,
          progressPercent: toNumber(enrollment.progressPercent, 0),
          completedLessons: (enrollment.completedLessons || []).map((id: any) =>
            String(id)
          ),
          enrolledAt: enrollment.enrolledAt,
          course: normalizeCourse(enrollment.course),
        })),
    });
  } catch (error) {
    next(error);
  }
}

/* ------------------------------------------------------------------ *
 * Admin approval workflow (5.2 Safety)
 * ------------------------------------------------------------------ */

export async function listPendingCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courses: any[] = await Course.find({
      approvalStatus: CourseApprovalStatus.PENDING_APPROVAL,
    })
      .populate("instructor", "name email role")
      .sort({ updatedAt: 1 })
      .lean();

    return res.json({ courses: courses.map((c) => normalizeCourse(c)) });
  } catch (error) {
    next(error);
  }
}

export async function reviewCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const admin = getCurrentUser(req);
    const courseId = String(req.params.courseId || "");
    const decision = String(req.body.decision || "").trim().toUpperCase();

    const course: any = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (decision === "APPROVE") {
      course.approvalStatus = CourseApprovalStatus.APPROVED;
      course.isPublished = true;
      course.approvedBy = admin._id;
      course.approvedAt = new Date();
      course.rejectionReason = undefined;
    } else if (decision === "REJECT") {
      course.approvalStatus = CourseApprovalStatus.REJECTED;
      course.isPublished = false;
      course.rejectionReason = String(req.body.reason || "").trim() || "Rejected.";
    } else {
      return res
        .status(400)
        .json({ message: "decision must be APPROVE or REJECT." });
    }

    await course.save();

    return res.json({
      message: `Course ${decision.toLowerCase()}d.`,
      course: normalizeCourse(course),
    });
  } catch (error) {
    next(error);
  }
}
