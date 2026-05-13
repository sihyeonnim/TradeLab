import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import AuthLayout from "../components/AuthLayout";

export default function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "user@tradelab.local",
    password: "password123",
  });

  const [status, setStatus] = useState({
    loading: false,
    error: "",
  });

  function updateField(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setStatus({
      loading: true,
      error: "",
    });

    try {
      await api.post("/auth/login", form);
      navigate("/dashboard");
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Login failed.",
      });
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in with your verified TradeLab account."
      footer={
        <>
          Need an account? <Link to="/register">Register</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form">
        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            required
          />
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={updateField}
            required
          />
        </label>

        <button disabled={status.loading}>
          {status.loading ? "Logging in..." : "Login"}
        </button>

        {status.error && <p className="error">{status.error}</p>}

        <div className="demo-box">
          <strong>Demo accounts</strong>
          <span>Admin: admin@tradelab.local / password123</span>
          <span>Instructor: instructor@tradelab.local / password123</span>
          <span>User: user@tradelab.local / password123</span>
        </div>
      </form>
    </AuthLayout>
  );
}