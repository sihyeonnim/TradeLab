import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import AuthLayout from "../components/AuthLayout";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const hasVerifiedRef = useRef(false);

  const [status, setStatus] = useState({
    loading: true,
    message: "",
    error: "",
  });

  useEffect(() => {
    async function verify() {
      if (hasVerifiedRef.current) {
        return;
      }

      hasVerifiedRef.current = true;

      if (!token) {
        setStatus({
          loading: false,
          message: "",
          error: "Verification token is missing.",
        });
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);

        setStatus({
          loading: false,
          message: response.data.message,
          error: "",
        });
      } catch (error) {
        setStatus({
          loading: false,
          message: "",
          error: error.response?.data?.message || "Email verification failed.",
        });
      }
    }

    verify();
  }, [token]);

  return (
    <AuthLayout
      title="Email verification"
      subtitle="Activating your TradeLab account."
      footer={
        <>
          After verification, <Link to="/login">log in here</Link>.
        </>
      }
    >
      <div className="message-panel">
        {status.loading && <p>Verifying your email...</p>}
        {status.message && <p className="success">{status.message}</p>}
        {status.error && <p className="error">{status.error}</p>}
      </div>
    </AuthLayout>
  );
}