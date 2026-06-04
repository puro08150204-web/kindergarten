"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Field, Notice, inputClass } from "@/components/ui";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.replace(searchParams.get("next") || "/admin");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登入失敗。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-8">
      <form className="grid w-full gap-4 rounded-md bg-white p-5 shadow-soft" onSubmit={login}>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-leaf/[0.12] text-leaf">
            <LockKeyhole size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-leaf">Library Admin</p>
            <h1 className="text-2xl font-bold text-ink">後台密碼</h1>
          </div>
        </div>
        {error && <Notice tone="bad">{error}</Notice>}
        <Field label="請輸入密碼">
          <input
            className={inputClass}
            type="password"
            inputMode="numeric"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button disabled={loading || !password}>進入後台</Button>
      </form>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
