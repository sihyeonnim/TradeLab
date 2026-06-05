import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

import { Course, Lesson, Enrollment, ActivityLog } from "../models";
import { toPublicVideoPath } from "../middleware/upload.middleware";

const CourseModel: any = Course;
const LessonModel: any = Lesson;
const EnrollmentModel: any = Enrollment;
const ActivityLogModel: any = ActivityLog;

const COURSE_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

const ENROLLMENT_STATUS = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  DROPPED: "DROPPED",
} as const;

function getCurrentUser(req: Request): any {
  return (req as any).user;
}

function getCurrentUserId(req: Request): string {
  return String(getCurrentUser(req)._id);
}

function isAdmin(req: Request): boolean {
  return getCurrentUser(req)?.role === "ADMIN";
}

function isInstructor(req: Request): boolean {
  return getCurrentUser(req)?.role === "INSTRUCTOR";
}

function isUser(req: Request): boolean {
  return getCurrentUser(req)?.role === "USER";
}

function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function isApprovedCourse(course: any): boolean {
  const plain = asPlainDoc(course);

  return (
    plain?.approvalStatus === COURSE_STATUS.APPROVED &&
    plain?.isPublished === true
  );
}

function getParam(req: Request, name: string): string {
  const value = req.params[name];

  if (Array.isArray(value)) {
    return String(value[0] || "");
  }

  return String(value || "");
}

function asPlainDoc(doc: any) {
  if (!doc) {
    return null;
  }

  if (typeof doc.toObject === "function") {
    return doc.toObject({
      virtuals: false,
      getters: false,
      depopulate: false,
    });
  }

  if (doc._doc) {
    return doc._doc;
  }

  return doc;
}

function getDocId(doc: any): string | null {
  const plain = asPlainDoc(doc);

  if (!plain) {
    return null;
  }

  const id = plain._id ?? plain.id ?? doc?._id ?? doc?.id;

  return id ? String(id) : null;
}

function getIdValue(value: any): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return String(value._id);
  }

  if (value.id) {
    return String(value.id);
  }

  if (value._doc?._id) {
    return String(value._doc._id);
  }

  return String(value);
}

function canManageCourse(req: Request, course: any): boolean {
  if (isAdmin(req)) {
    return true;
  }

  if (!isInstructor(req)) {
    return false;
  }

  const plain = asPlainDoc(course);
  const instructorId = getIdValue(plain?.instructor ?? course?.instructor);
  const currentUserId = getCurrentUserId(req);

  return instructorId === currentUserId;
}

function normalizeUser(user: any) {
  const plain = asPlainDoc(user);

  if (!plain) {
    return null;
  }

  return {
    id: getDocId(user),
    name: plain.name,
    displayName: plain.displayName || plain.name,
    email: plain.email,
    role: plain.role,
    isEmailVerified: plain.isEmailVerified,
    createdAt: plain.createdAt,
  };
}

function normalizeCourse(course: any) {
  const plain = asPlainDoc(course);

  if (!plain) {
    return null;
  }

  const instructor = plain.instructor;
  const approvedBy = plain.approvedBy;

  return {
    id: getDocId(course),
    title: plain.title,
    description: plain.description,
    instructor:
      instructor && typeof instructor === "object" && (instructor.name || instructor.email)
        ? normalizeUser(instructor)
        : instructor
          ? String(instructor)
          : null,
    level: plain.level,
    tags: plain.tags || [],
    approvalStatus: plain.approvalStatus,
    isPublished: Boolean(plain.isPublished),
    approvedBy:
      approvedBy && typeof approvedBy === "object" && (approvedBy.name || approvedBy.email)
        ? normalizeUser(approvedBy)
        : approvedBy
          ? String(approvedBy)
          : null,
    approvedAt: plain.approvedAt ?? null,
    rejectionReason: plain.rejectionReason ?? null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function normalizeLesson(lesson: any) {
  const plain = asPlainDoc(lesson);

  if (!plain) {
    return null;
  }

  const video = plain.video || {};
  const videoPath = video.path || "NO_VIDEO";

  return {
    id: getDocId(lesson),
    course:
      plain.course && typeof plain.course === "object"
        ? String(plain.course._id ?? plain.course.id)
        : String(plain.course),
    title: plain.title,
    order: plain.order,
    summary: plain.summary,
    contentMarkdown: plain.contentMarkdown,
    video: {
      provider: video.provider || "DUMMY",
      path: videoPath,
      durationSeconds: video.durationSeconds ?? null,
      thumbnailPath: video.thumbnailPath ?? null,
    },
    videoUrl:
      video.provider === "LOCAL" && String(videoPath).startsWith("/uploads/")
        ? videoPath
        : null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function normalizeEnrollment(enrollment: any) {
  const plain = asPlainDoc(enrollment);

  if (!plain) {
    return null;
  }

  return {
    id: getDocId(enrollment),
    user:
      plain.user && typeof plain.user === "object" && (plain.user.name || plain.user.email)
        ? normalizeUser(plain.user)
        : plain.user
          ? String(plain.user)
          : null,
    course:
      plain.course && typeof plain.course === "object" && plain.course.title
        ? normalizeCourse(plain.course)
        : plain.course
          ? String(plain.course)
          : null,
    status: plain.status,
    progressPercent: plain.progressPercent,
    completedLessons: plain.completedLessons || [],
    enrolledAt: plain.enrolledAt,
    completedAt: plain.completedAt ?? null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

async function safeCreateActivityLog(data: {
  user: string;
  action: "COURSE_CREATED" | "COURSE_APPROVED" | "COURSE_ENROLLED";
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await ActivityLogModel.create({
      user: data.user,
      action: data.action,
      message: data.message,
      metadata: data.metadata || {},
    });
  } catch (error) {
    console.warn("ActivityLog skipped:", (error as Error).message);
  }
}

function removeLocalFileIfExists(publicPath?: string | null) {
  if (!publicPath || !publicPath.startsWith("/uploads/videos/")) {
    return;
  }

  const absolutePath = path.join(
    __dirname,
    "..",
    "..",
    publicPath.replace(/^\//, "")
  );

  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

async function findCourseOr404(courseId: string) {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return null;
  }

  return CourseModel.findById(courseId);
}

async function findLessonWithCourse(lessonId: string) {
  if (!mongoose.Types.ObjectId.isValid(lessonId)) {
    return null;
  }

  const lesson: any = await LessonModel.findById(lessonId);

  if (!lesson) {
    return null;
  }

  const lessonPlain = asPlainDoc(lesson);
  const courseId = getIdValue(lessonPlain?.course ?? lesson.course);

  if (!courseId || !mongoose.Types.ObjectId.isValid(courseId)) {
    return null;
  }

  const course: any = await CourseModel.findById(courseId);

  if (!course) {
    return null;
  }

  return { lesson, course };
}

export async function listApprovedCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courses = await CourseModel.find({
      approvalStatus: COURSE_STATUS.APPROVED,
      isPublished: true,
    })
      .populate("instructor", "name displayName email role")
      .sort({ createdAt: -1 });

    return res.json({
      courses: courses.map(normalizeCourse),
    });
  } catch (error) {
    next(error);
  }
}

export async function getCourseDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const course: any = await CourseModel.findById(getParam(req, "courseId"))
      .populate("instructor", "name displayName email role")
      .populate("approvedBy", "name displayName email role");

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const canView =
      isApprovedCourse(course) ||
      isAdmin(req) ||
      canManageCourse(req, course);

    if (!canView) {
      return res.status(403).json({
        message: "You do not have permission to view this course.",
      });
    }

    return res.json({
      course: normalizeCourse(course),
    });
  } catch (error) {
    next(error);
  }
}

export async function createInstructorCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { title, description, level } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        message: "title and description are required.",
      });
    }

    const course: any = await CourseModel.create({
      title: String(title).trim(),
      description: String(description).trim(),
      instructor: getCurrentUserId(req),
      level: level ? String(level).trim() : "BEGINNER",
      tags: toStringArray(req.body.tags),
      approvalStatus: COURSE_STATUS.PENDING_APPROVAL,
      isPublished: false,
    });

    await safeCreateActivityLog({
      user: getCurrentUserId(req),
      action: "COURSE_CREATED",
      message: "Course created",
      metadata: {
        courseId: String(course._id),
        title: course.title,
      },
    });

    const createdCourse: any = await CourseModel.findById(course._id).populate(
      "instructor",
      "name displayName email role"
    );

    return res.status(201).json({
      message: "Course created and submitted for approval.",
      course: normalizeCourse(createdCourse || course),
    });
  } catch (error) {
    next(error);
  }
}

export async function listInstructorCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const filter = isAdmin(req)
      ? {}
      : {
          instructor: getCurrentUserId(req),
        };

    const courses = await CourseModel.find(filter)
      .populate("instructor", "name displayName email role")
      .sort({ createdAt: -1 });

    return res.json({
      courses: courses.map(normalizeCourse),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateInstructorCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const course: any = await findCourseOr404(getParam(req, "courseId"));

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (!canManageCourse(req, course)) {
      return res.status(403).json({
        message: "You do not have permission to edit this course.",
      });
    }

    const allowedFields = ["title", "description", "level"];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        course[field] = String(req.body[field]).trim();
      }
    }

    if (req.body.tags !== undefined) {
      course.tags = toStringArray(req.body.tags);
    }

    if (!isAdmin(req) && course.approvalStatus === COURSE_STATUS.APPROVED) {
      course.approvalStatus = COURSE_STATUS.PENDING_APPROVAL;
      course.isPublished = false;
      course.approvedBy = undefined;
      course.approvedAt = undefined;
      course.rejectionReason = undefined;
    }

    if (course.approvalStatus === COURSE_STATUS.REJECTED) {
      course.approvalStatus = COURSE_STATUS.PENDING_APPROVAL;
      course.isPublished = false;
      course.rejectionReason = undefined;
    }

    await course.save();

    const populated: any = await CourseModel.findById(course._id).populate(
      "instructor",
      "name displayName email role"
    );

    return res.json({
      message: "Course updated.",
      course: normalizeCourse(populated || course),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteInstructorCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const course: any = await findCourseOr404(getParam(req, "courseId"));

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (!canManageCourse(req, course)) {
      return res.status(403).json({
        message: "You do not have permission to delete this course.",
      });
    }

    const courseId = String(course._id);
    const lessons: any[] = await LessonModel.find({ course: courseId });

    for (const lesson of lessons) {
      removeLocalFileIfExists(lesson.video?.path);
    }

    await LessonModel.deleteMany({ course: courseId });
    await EnrollmentModel.deleteMany({ course: courseId });
    await CourseModel.deleteOne({ _id: courseId });

    return res.json({
      message: "Course deleted.",
      courseId,
      deletedLessonCount: lessons.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function createLesson(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const course: any = await findCourseOr404(getParam(req, "courseId"));

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (!canManageCourse(req, course)) {
      return res.status(403).json({
        message: "You do not have permission to add lessons to this course.",
      });
    }

    const courseIdForDb = getIdValue(course);

    if (!courseIdForDb) {
      return res.status(500).json({
        message: "Failed to resolve course id.",
      });
    }

    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "title is required.",
      });
    }

    const file = req.file;
    const publicVideoPath = toPublicVideoPath(file);

    const lesson: any = await LessonModel.create({
      course: courseIdForDb,
      title: String(title).trim(),
      order: toNumber(req.body.order, 1),
      summary: req.body.summary ?? req.body.description ?? "",
      contentMarkdown: req.body.contentMarkdown ?? req.body.content ?? "",
      video: publicVideoPath
        ? {
            provider: "LOCAL",
            path: publicVideoPath,
            durationSeconds:
              req.body.durationSeconds !== undefined
                ? toNumber(req.body.durationSeconds, 0)
                : req.body.durationMinutes !== undefined
                  ? toNumber(req.body.durationMinutes, 0) * 60
                  : undefined,
          }
        : {
            provider: "DUMMY",
            path: "NO_VIDEO",
          },
    });

    return res.status(201).json({
      message: publicVideoPath
        ? "Lesson created with uploaded video."
        : "Lesson created without video.",
      lesson: normalizeLesson(lesson),
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "A lesson with the same order already exists in this course.",
      });
    }

    next(error);
  }
}

export async function listCourseLessons(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const course: any = await findCourseOr404(getParam(req, "courseId"));

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const canView =
      isApprovedCourse(course) || isAdmin(req) || canManageCourse(req, course);

    if (!canView) {
      return res.status(403).json({
        message: "You do not have permission to view these lessons.",
      });
    }

    const courseIdForDb = getIdValue(course);

    if (!courseIdForDb) {
      return res.status(500).json({
        message: "Failed to resolve course id.",
      });
    }

    const lessons = await LessonModel.find({ course: courseIdForDb }).sort({
      order: 1,
      createdAt: 1,
    });

    return res.json({
      lessons: lessons.map(normalizeLesson),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLesson(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await findLessonWithCourse(getParam(req, "lessonId"));

    if (!result) {
      return res.status(404).json({ message: "Lesson not found." });
    }

    const { lesson, course } = result;

    if (!canManageCourse(req, course)) {
      return res.status(403).json({
        message: "You do not have permission to edit this lesson.",
      });
    }

    if (req.body.title !== undefined) {
      lesson.title = String(req.body.title).trim();
    }

    if (req.body.order !== undefined) {
      lesson.order = toNumber(req.body.order, lesson.order);
    }

    if (req.body.summary !== undefined || req.body.description !== undefined) {
      lesson.summary = req.body.summary ?? req.body.description;
    }

    if (req.body.contentMarkdown !== undefined || req.body.content !== undefined) {
      lesson.contentMarkdown = req.body.contentMarkdown ?? req.body.content;
    }

    const publicVideoPath = toPublicVideoPath(req.file);

    if (publicVideoPath) {
      removeLocalFileIfExists(lesson.video?.path);

      lesson.video = {
        provider: "LOCAL",
        path: publicVideoPath,
        durationSeconds:
          req.body.durationSeconds !== undefined
            ? toNumber(req.body.durationSeconds, 0)
            : req.body.durationMinutes !== undefined
              ? toNumber(req.body.durationMinutes, 0) * 60
              : lesson.video?.durationSeconds,
      };
    }

    await lesson.save();

    return res.json({
      message: "Lesson updated.",
      lesson: normalizeLesson(lesson),
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "A lesson with the same order already exists in this course.",
      });
    }

    next(error);
  }
}

export async function deleteLesson(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await findLessonWithCourse(getParam(req, "lessonId"));

    if (!result) {
      return res.status(404).json({ message: "Lesson not found." });
    }

    const { lesson, course } = result;

    if (!canManageCourse(req, course)) {
      return res.status(403).json({
        message: "You do not have permission to delete this lesson.",
      });
    }

    removeLocalFileIfExists(lesson.video?.path);

    await LessonModel.deleteOne({ _id: lesson._id });

    return res.json({
      message: "Lesson deleted.",
      lessonId: String(lesson._id),
    });
  } catch (error) {
    next(error);
  }
}

export async function listAdminCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courses = await CourseModel.find({})
      .populate("instructor", "name displayName email role")
      .populate("approvedBy", "name displayName email role")
      .sort({ createdAt: -1 });

    return res.json({
      courses: courses.map(normalizeCourse),
    });
  } catch (error) {
    next(error);
  }
}

export async function listPendingCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courses = await CourseModel.find({
      approvalStatus: COURSE_STATUS.PENDING_APPROVAL,
    })
      .populate("instructor", "name displayName email role")
      .sort({ createdAt: -1 });

    return res.json({
      courses: courses.map(normalizeCourse),
    });
  } catch (error) {
    next(error);
  }
}

export async function approveCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courseId = getParam(req, "courseId");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Valid courseId is required.",
      });
    }

    const updatedCourse: any = await CourseModel.findByIdAndUpdate(
      courseId,
      {
        $set: {
          approvalStatus: COURSE_STATUS.APPROVED,
          isPublished: true,
          approvedBy: getCurrentUserId(req),
          approvedAt: new Date(),
        },
        $unset: {
          rejectionReason: "",
        },
      },
      {
        returnDocument: "after",
      }
    )
      .populate("instructor", "name displayName email role")
      .populate("approvedBy", "name displayName email role");

    if (!updatedCourse) {
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    await safeCreateActivityLog({
      user: getCurrentUserId(req),
      action: "COURSE_APPROVED",
      message: "Course approved",
      metadata: {
        courseId,
        title: asPlainDoc(updatedCourse)?.title,
      },
    });

    return res.json({
      message: "Course approved.",
      course: normalizeCourse(updatedCourse),
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courseId = getParam(req, "courseId");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Valid courseId is required.",
      });
    }

    const updatedCourse: any = await CourseModel.findByIdAndUpdate(
      courseId,
      {
        $set: {
          approvalStatus: COURSE_STATUS.REJECTED,
          isPublished: false,
          rejectionReason:
            req.body.reason || req.body.rejectionReason || "Rejected by admin.",
        },
      },
      {
        returnDocument: "after",
      }
    )
      .populate("instructor", "name displayName email role")
      .populate("approvedBy", "name displayName email role");

    if (!updatedCourse) {
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    return res.json({
      message: "Course rejected.",
      course: normalizeCourse(updatedCourse),
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
    const course: any = await findCourseOr404(getParam(req, "courseId"));

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    if (!isApprovedCourse(course)) {
      return res.status(400).json({
        message: "Only approved and published courses can be enrolled.",
      });
    }

    const courseIdForDb = getIdValue(course);

    if (!courseIdForDb) {
      return res.status(500).json({
        message: "Failed to resolve course id.",
      });
    }

    const userId = getCurrentUserId(req);

    const existing = await EnrollmentModel.findOne({
      user: userId,
      course: courseIdForDb,
    });

    if (existing) {
      return res.status(409).json({
        message: "You are already enrolled in this course.",
        enrollment: normalizeEnrollment(existing),
      });
    }

    const enrollment: any = await EnrollmentModel.create({
      user: userId,
      course: courseIdForDb,
      status: ENROLLMENT_STATUS.ACTIVE,
      progressPercent: 0,
      completedLessons: [],
      enrolledAt: new Date(),
    });

    await safeCreateActivityLog({
      user: userId,
      action: "COURSE_ENROLLED",
      message: "User enrolled in course",
      metadata: {
        courseId: courseIdForDb,
        title: asPlainDoc(course)?.title,
      },
    });

    const populated: any = await EnrollmentModel.findById(enrollment._id)
      .populate({
        path: "course",
        populate: {
          path: "instructor",
          select: "name displayName email role",
        },
      })
      .populate("user", "name displayName email role");

    return res.status(201).json({
      message: "Enrolled successfully.",
      enrollment: normalizeEnrollment(populated || enrollment),
    });
  } catch (error) {
    next(error);
  }
}

export async function unenrollFromCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isUser(req)) {
      return res.status(403).json({
        message: "Only USER accounts can unenroll from courses.",
      });
    }

    const courseId = getParam(req, "courseId");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Valid courseId is required.",
      });
    }

    const course: any = await CourseModel.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const enrollment: any = await EnrollmentModel.findOne({
      user: getCurrentUserId(req),
      course: courseId,
    });

    if (!enrollment) {
      return res.status(404).json({
        message: "Enrollment not found.",
      });
    }

    await EnrollmentModel.deleteOne({ _id: enrollment._id });

    return res.json({
      message: "Unenrolled successfully.",
      courseId,
    });
  } catch (error) {
    next(error);
  }
}

export async function listInstructorCourseEnrollments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courseId = getParam(req, "courseId");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Valid courseId is required.",
      });
    }

    const course: any = await CourseModel.findById(courseId).populate(
      "instructor",
      "name displayName email role"
    );

    if (!course) {
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    if (!canManageCourse(req, course)) {
      return res.status(403).json({
        message: "You do not have permission to view enrollments for this course.",
      });
    }

    const enrollments: any[] = await EnrollmentModel.find({
      course: courseId,
    })
      .populate("user", "name displayName email role isEmailVerified createdAt")
      .sort({ enrolledAt: -1 });

    return res.json({
      course: normalizeCourse(course),
      enrollments: enrollments.map(normalizeEnrollment),
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyEnrollments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const enrollments = await EnrollmentModel.find({
      user: getCurrentUserId(req),
    })
      .populate({
        path: "course",
        populate: {
          path: "instructor",
          select: "name displayName email role",
        },
      })
      .sort({ enrolledAt: -1 });

    return res.json({
      enrollments: enrollments.map(normalizeEnrollment),
    });
  } catch (error) {
    next(error);
  }
}
