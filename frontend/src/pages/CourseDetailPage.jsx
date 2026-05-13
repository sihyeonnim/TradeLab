import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { buildVideoSrc, canPlayLocalVideo } from "../video";

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
  });

  async function loadData() {
    const [courseResponse, lessonsResponse] = await Promise.all([
      api.get(`/courses/${courseId}`),
      api.get(`/courses/${courseId}/lessons`),
    ]);

    setCourse(courseResponse.data.course);
    setLessons(lessonsResponse.data.lessons || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadData();
        setStatus({ loading: false, error: "", message: "" });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load course.",
          message: "",
        });
      }
    }

    init();
  }, [courseId, navigate]);

  async function enroll() {
    try {
      const response = await api.post(`/courses/${courseId}/enroll`);
      setStatus({ loading: false, error: "", message: response.data.message });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Enrollment failed.",
        message: "",
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading course...</p>
      </main>
    );
  }

  if (status.error && !course) {
    return (
      <main className="dashboard-shell">
        <p className="error">{status.error}</p>
        <Link to="/courses">Back to courses</Link>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>{course?.title}</h1>
          <p className="dashboard-subtitle">{course?.description}</p>
        </div>

        <Link className="nav-button" to="/courses">
          Courses
        </Link>
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

          <button onClick={enroll}>Enroll in this course</button>
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

                    {videoSrc ? (
                      <video className="lesson-video" controls src={videoSrc} />
                    ) : (
                      <div className="video-placeholder">
                        No uploaded video for this lesson.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </main>
  );
}