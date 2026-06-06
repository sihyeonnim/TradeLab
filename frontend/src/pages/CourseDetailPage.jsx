import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { buildVideoSrc, canPlayLocalVideo } from "../video";
import BottomNav from "../components/BottomNav.jsx";

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
    submitting: false,
  });

  async function loadData() {
    const [meResponse, courseResponse, lessonsResponse, enrollmentsResponse] =
      await Promise.all([
        api.get("/auth/me"),
        api.get(`/courses/${courseId}`),
        api.get(`/courses/${courseId}/lessons`),
        api.get("/enrollments/me").catch(() => ({ data: { enrollments: [] } })),
      ]);

    setUser(meResponse.data.user);
    setCourse(courseResponse.data.course);
    setLessons(lessonsResponse.data.lessons || []);
    setEnrollments(enrollmentsResponse.data.enrollments || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadData();
        setStatus({ loading: false, error: "", message: "", submitting: false });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load course.",
          message: "",
          submitting: false,
        });
      }
    }

    init();
  }, [courseId, navigate]);

  function getEnrollmentCourseId(enrollment) {
    if (!enrollment?.course) {
      return null;
    }

    if (typeof enrollment.course === "string") {
      return enrollment.course;
    }

    return enrollment.course.id || enrollment.course._id || null;
  }

  const enrolled = useMemo(() => {
    return enrollments.some(
      (enrollment) => String(getEnrollmentCourseId(enrollment)) === String(courseId)
    );
  }, [courseId, enrollments]);

  const currentEnrollment = useMemo(() => {
    return (
      enrollments.find(
        (enrollment) => String(getEnrollmentCourseId(enrollment)) === String(courseId)
      ) || null
    );
  }, [courseId, enrollments]);

  const completedLessonIds = useMemo(() => {
    return new Set(
      (currentEnrollment?.completedLessons || []).map((lessonId) => String(lessonId))
    );
  }, [currentEnrollment]);

  const progressPercent = Number(currentEnrollment?.progressPercent || 0);

  function isLessonCompleted(lessonId) {
    return completedLessonIds.has(String(lessonId));
  }

  async function markLessonCompleted(lessonId) {
    setStatus((prev) => ({ ...prev, error: "", message: "", submitting: true }));

    try {
      const response = await api.post(
        `/courses/${courseId}/lessons/${lessonId}/complete`
      );
      await loadData();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Lesson completed.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.response?.data?.message || "Failed to mark lesson as completed.",
        message: "",
        submitting: false,
      });
    }
  }

  async function enroll() {
    setStatus((prev) => ({ ...prev, error: "", message: "", submitting: true }));

    try {
      const response = await api.post(`/courses/${courseId}/enroll`);
      await loadData();
      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Enrolled successfully.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Enrollment failed.",
        message: "",
        submitting: false,
      });
    }
  }

  async function unenroll() {
    const confirmed = window.confirm(
      "Do you want to unenroll from this course? You can enroll again later if the course is still available."
    );

    if (!confirmed) {
      return;
    }

    setStatus((prev) => ({ ...prev, error: "", message: "", submitting: true }));

    try {
      const response = await api.delete(`/courses/${courseId}/enroll`);
      await loadData();
      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Unenrolled successfully.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Unenrollment failed.",
        message: "",
        submitting: false,
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading course...</p>
      </main>
    );
  }

  if (status.error && !course) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p className="error">{status.error}</p>
        <Link className="secondary-button link-button" to="/courses">
          Back to courses
        </Link>
        <BottomNav user={user} />
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>{course?.title}</h1>
          <p className="dashboard-subtitle">{course?.description}</p>
        </div>

        <div className="user-pill">
          {user?.displayName || user?.name || "User"}
        </div>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      <section className="dashboard-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">Course information</p>
          <h3>{course?.title}</h3>
          <p>{course?.description}</p>
          <p className="muted-text">
            Instructor: {course?.instructor?.name || "Unknown"}
          </p>
          <p className="muted-text">Level: {course?.level || "-"}</p>

          {enrolled && (
            <div className="course-progress-box">
              <div className="course-progress-header">
                <span>Progress</span>
                <strong>{progressPercent}%</strong>
              </div>
              <div className="course-progress-track">
                <div
                  className="course-progress-fill"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
              <p className="muted-text">
                Completed {completedLessonIds.size} of {lessons.length} lessons.
              </p>
            </div>
          )}

          <div className="tag-row">
            {(course?.tags || []).map((tag) => (
              <span className="tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <div className="action-row">
            <Link className="secondary-button link-button" to="/courses">
              Back to Courses
            </Link>

            {user?.role === "USER" ? (
              enrolled ? (
                <button
                  type="button"
                  className="danger-button"
                  onClick={unenroll}
                  disabled={status.submitting}
                >
                  {status.submitting ? "Processing..." : "Unenroll from this course"}
                </button>
              ) : (
                <button onClick={enroll} disabled={status.submitting}>
                  {status.submitting ? "Processing..." : "Enroll in this course"}
                </button>
              )
            ) : (
              <button disabled>Users only</button>
            )}
          </div>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Lessons</p>
          <h3>Course lessons</h3>

          <div className="lesson-list">
            {lessons.length === 0 ? (
              <p>No lessons yet.</p>
            ) : (
              lessons.map((lesson) => {
                const videoSrc = canPlayLocalVideo(lesson)
                  ? buildVideoSrc(lesson.video.path)
                  : null;

                return (
                  <div className="lesson-card" key={lesson.id}>
                    <div>
                      <p className="eyebrow">Lesson {lesson.order}</p>
                      <h3>{lesson.title}</h3>
                      <p>{lesson.summary}</p>
                      <p className="muted-text">{lesson.contentMarkdown}</p>
                    </div>

                    {enrolled ? (
                      <>
                        {videoSrc ? (
                          <video className="lesson-video" controls src={videoSrc} />
                        ) : (
                          <div className="video-placeholder">
                            No uploaded video for this lesson.
                          </div>
                        )}

                        <div className="action-row">
                          {isLessonCompleted(lesson.id) ? (
                            <button type="button" className="secondary-button" disabled>
                              Completed
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => markLessonCompleted(lesson.id)}
                              disabled={status.submitting}
                            >
                              {status.submitting
                                ? "Saving..."
                                : "Mark as Completed"}
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="video-placeholder">
                        Enroll in this course to access the lesson content.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>

      <BottomNav user={user} />
    </main>
  );
}
