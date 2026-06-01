import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

function formatPrice(value) {
  const n = Number(value || 0);
  if (n <= 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CourseDetailPage() {
  const navigate = useNavigate();
  const { courseId } = useParams();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [actionMsg, setActionMsg] = useState("");

  async function load() {
    const res = await api.get(`/courses/${courseId}`);
    setCourse(res.data.course);
    setLessons(res.data.lessons || []);
    setActiveLessonId((prev) => prev || res.data.lessons?.[0]?.id || null);
    setStatus({ loading: false, error: "" });
  }

  useEffect(() => {
    async function init() {
      try {
        await load();
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }
        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load course.",
        });
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, navigate]);

  async function handleEnroll() {
    setActionMsg("");
    try {
      const res = await api.post(`/courses/${courseId}/enroll`);
      setActionMsg(res.data.message || "Enrolled.");
      await load();
    } catch (error) {
      setActionMsg(error.response?.data?.message || "Enrollment failed.");
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading course...</p>
      </main>
    );
  }

  if (status.error) {
    return (
      <main className="dashboard-shell">
        <div className="dashboard-card">
          <p className="error">{status.error}</p>
          <button className="secondary-button" onClick={() => navigate("/courses")}>
            Back to courses
          </button>
        </div>
      </main>
    );
  }

  const hasAccess = course?.hasContentAccess;
  const activeLesson = lessons.find((l) => l.id === activeLessonId) || null;

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>{course?.title}</h1>
          <p className="dashboard-subtitle">
            {course?.instructor?.name || "Instructor"} · {course?.level} ·{" "}
            {formatPrice(course?.price)}
          </p>
        </div>
        <button className="secondary-button" onClick={() => navigate("/courses")}>
          Back to courses
        </button>
      </nav>

      <section className="dashboard-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">About</p>
          <h3>Course overview</h3>
          <p>{course?.description}</p>

          {!course?.isEnrolled && (
            <div className="enroll-cta">
              <button onClick={handleEnroll}>
                Enroll {course?.price > 0 ? `· ${formatPrice(course.price)}` : "for free"}
              </button>
              {!hasAccess && (
                <span className="dashboard-subtitle">
                  Enroll to unlock lesson videos and materials.
                </span>
              )}
            </div>
          )}
          {actionMsg && <p className="success">{actionMsg}</p>}
        </article>

        <article className="dashboard-card">
          <p className="eyebrow">Curriculum</p>
          <h3>{lessons.length} lessons</h3>
          <div className="lesson-list">
            {lessons.map((lesson) => (
              <button
                type="button"
                key={lesson.id}
                className={`lesson-item${
                  lesson.id === activeLessonId ? " active" : ""
                }`}
                onClick={() => setActiveLessonId(lesson.id)}
              >
                <span className="lesson-order">{lesson.order}</span>
                <span className="lesson-title">{lesson.title}</span>
                {course?.completedLessons?.includes(lesson.id) && (
                  <span className="lesson-check">✓</span>
                )}
              </button>
            ))}
            {lessons.length === 0 && <p>No lessons yet.</p>}
          </div>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Lesson</p>
          <h3>{activeLesson?.title || "Select a lesson"}</h3>

          {!activeLesson ? (
            <p>No lesson selected.</p>
          ) : !hasAccess ? (
            <div className="locked-content">
              <p>🔒 This content is locked.</p>
              <p className="dashboard-subtitle">
                {activeLesson.summary || "Enroll in this course to access the video and materials."}
              </p>
            </div>
          ) : (
            <div className="lesson-content">
              <div className="video-frame">
                {activeLesson.video?.provider === "YOUTUBE" ? (
                  <iframe
                    title={activeLesson.title}
                    src={`https://www.youtube.com/embed/${activeLesson.video.path}`}
                    allowFullScreen
                  />
                ) : (
                  <div className="video-placeholder">
                    <p>▶ Video</p>
                    <span className="dashboard-subtitle">
                      {activeLesson.video?.path || "No video source"}
                    </span>
                  </div>
                )}
              </div>
              {activeLesson.summary && <p>{activeLesson.summary}</p>}
              {activeLesson.contentMarkdown && (
                <pre className="lesson-markdown">{activeLesson.contentMarkdown}</pre>
              )}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
