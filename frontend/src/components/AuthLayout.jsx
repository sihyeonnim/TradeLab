import { Link } from "react-router-dom";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <div className="brand-badge">TradeLab</div>
        <h1>Practice markets. Learn strategy. Compete safely.</h1>
        <p>
          A dark, simulation-first trading education platform for users,
          instructors, and administrators.
        </p>

        <div className="stat-grid">
          <div>
            <strong>USER</strong>
            <span>Portfolio simulation</span>
          </div>
          <div>
            <strong>INSTRUCTOR</strong>
            <span>Courses and content</span>
          </div>
          <div>
            <strong>ADMIN</strong>
            <span>System management</span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>

        {children}

        {footer && <div className="footer-text">{footer}</div>}

        <div className="small-links">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      </section>
    </main>
  );
}