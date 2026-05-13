import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import AuthLayout from "../components/AuthLayout";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "USER",
  });

  const [status, setStatus] = useState({
    loading: false,
    message: "",
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
      message: "",
      error: "",
    });

    try {
      const response = await api.post("/auth/register", form);

      setStatus({
        loading: false,
        message: response.data.message,
        error: "",
      });
    } catch (error) {
      setStatus({
        loading: false,
        message: "",
        error: error.response?.data?.message || "Registration failed.",
      });
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Register, verify your email, and start using TradeLab."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="form">
        <label>
          Display name
          <input
            name="displayName"
            value={form.displayName}
            onChange={updateField}
            placeholder="Sihyeon"
            required
          />
        </label>

        <label>
          Email
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            placeholder="you@example.com"
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
            placeholder="At least 8 characters"
            required
          />
        </label>

        <label>
          Role
          <select name="role" value={form.role} onChange={updateField}>
            <option value="USER">USER</option>
            <option value="INSTRUCTOR">INSTRUCTOR</option>
          </select>
        </label>

        <button disabled={status.loading}>
          {status.loading ? "Creating account..." : "Register"}
        </button>

        {status.message && <p className="success">{status.message}</p>}
        {status.error && <p className="error">{status.error}</p>}
      </form>
    </AuthLayout>
  );
}