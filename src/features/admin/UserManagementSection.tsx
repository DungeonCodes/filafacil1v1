"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AccessProfile, ManagedUserView } from "./types";
import { createManagedUser, loadManagedUsers, resetManagedUserPassword, updateManagedUserStatus } from "./usersApi";

const PROFILE_OPTIONS: { value: AccessProfile; label: string }[] = [
  { value: "attendant", label: "Atendente" },
  { value: "doctor", label: "Medico" },
  { value: "admin", label: "Administrador" }
];

type FeedbackState =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | null;

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getRoleLabel(role: AccessProfile): string {
  if (role === "attendant") {
    return "Atendente";
  }
  if (role === "doctor") {
    return "Medico";
  }
  return "Administrador";
}

export function UserManagementSection() {
  const [users, setUsers] = useState<ManagedUserView[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [runningActionUserId, setRunningActionUserId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AccessProfile>("attendant");
  const [isActive, setIsActive] = useState(true);
  const [resetPasswordsByUser, setResetPasswordsByUser] = useState<Record<number, string>>({});

  async function refreshUsers() {
    setIsLoadingUsers(true);
    const result = await loadManagedUsers();
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error });
      setIsLoadingUsers(false);
      return;
    }

    setUsers(result.data);
    setIsLoadingUsers(false);
  }

  useEffect(() => {
    void refreshUsers();
  }, []);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsSubmittingCreate(true);

    const result = await createManagedUser({
      username,
      password,
      role,
      isActive
    });

    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error });
      setIsSubmittingCreate(false);
      return;
    }

    setUsers((currentUsers) => [...currentUsers, result.data].sort((left, right) => left.username.localeCompare(right.username)));
    setUsername("");
    setPassword("");
    setRole("attendant");
    setIsActive(true);
    setFeedback({ kind: "success", message: `Usuario ${result.data.username} criado com sucesso.` });
    setIsSubmittingCreate(false);
  }

  async function handleToggleStatus(user: ManagedUserView) {
    setFeedback(null);
    setRunningActionUserId(user.id);

    const result = await updateManagedUserStatus(user.id, !user.isActive);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error });
      setRunningActionUserId(null);
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((currentUser) => {
        if (currentUser.id !== user.id) {
          return currentUser;
        }
        return result.data;
      })
    );
    setFeedback({
      kind: "success",
      message: `Usuario ${result.data.username} ${result.data.isActive ? "ativado" : "desativado"} com sucesso.`
    });
    setRunningActionUserId(null);
  }

  async function handleResetPassword(user: ManagedUserView) {
    const newPassword = (resetPasswordsByUser[user.id] ?? "").trim();
    if (!newPassword) {
      setFeedback({ kind: "error", message: "Informe a nova senha antes de redefinir." });
      return;
    }

    setFeedback(null);
    setRunningActionUserId(user.id);
    const result = await resetManagedUserPassword(user.id, newPassword);
    if (!result.ok) {
      setFeedback({ kind: "error", message: result.error });
      setRunningActionUserId(null);
      return;
    }

    setResetPasswordsByUser((currentValues) => ({
      ...currentValues,
      [user.id]: ""
    }));
    setFeedback({ kind: "success", message: `Senha de ${user.username} redefinida com sucesso.` });
    setRunningActionUserId(null);
  }

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.username.localeCompare(right.username)),
    [users]
  );

  return (
    <section className="mt-6 rounded-3xl border-2 border-slate-800 bg-slate-50 p-5">
      <h2 className="text-2xl font-black text-slate-900">Gestao de usuarios</h2>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        Cadastro de logins, perfil de acesso, ativacao e redefinicao de senha.
      </p>

      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded-xl border-2 px-4 py-3 text-sm font-semibold ${
            feedback.kind === "error"
              ? "border-rose-700 bg-rose-50 text-rose-900"
              : "border-emerald-700 bg-emerald-50 text-emerald-900"
          }`}
        >
          {feedback.message}
        </p>
      )}

      <form onSubmit={(event) => void handleCreateUser(event)} className="mt-4 grid gap-3 rounded-2xl border-2 border-slate-700 bg-white p-4 md:grid-cols-5">
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Usuario</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            className="min-h-11 rounded-xl border-2 border-slate-800 bg-white px-3 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Perfil</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as AccessProfile)}
            className="min-h-11 rounded-xl border-2 border-slate-800 bg-white px-3 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          >
            {PROFILE_OPTIONS.map((profile) => (
              <option key={profile.value} value={profile.value}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Senha inicial</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="min-h-11 rounded-xl border-2 border-slate-800 bg-white px-3 text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-1">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 rounded border-2 border-slate-700"
          />
          <span className="text-sm font-semibold text-slate-800">Ativo</span>
        </label>

        <div className="md:col-span-5">
          <button
            type="submit"
            disabled={isSubmittingCreate}
            className="min-h-11 rounded-xl border-2 border-slate-900 bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
          >
            {isSubmittingCreate ? "Criando..." : "Criar novo login"}
          </button>
        </div>
      </form>

      {isLoadingUsers ? (
        <p className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-sm font-semibold text-slate-700">Carregando usuarios...</p>
      ) : sortedUsers.length === 0 ? (
        <p className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-sm font-semibold text-slate-700">
          Nenhum usuario cadastrado.
        </p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label="Usuarios cadastrados">
          {sortedUsers.map((user) => {
            const isRunning = runningActionUserId === user.id;
            return (
              <li key={user.id} className="rounded-xl border border-slate-300 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-black text-slate-950">{user.username}</p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                      user.isActive
                        ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                        : "border-slate-500 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {user.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Perfil: {getRoleLabel(user.role)} • Atualizado em {formatDateTime(user.updatedAt)}
                </p>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => void handleToggleStatus(user)}
                    className="min-h-10 rounded-lg border-2 border-slate-800 bg-white px-3 text-xs font-black text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-400 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  >
                    {user.isActive ? "Desativar" : "Ativar"}
                  </button>

                  <label className="flex min-w-52 flex-1 flex-col gap-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Nova senha</span>
                    <input
                      type="password"
                      value={resetPasswordsByUser[user.id] ?? ""}
                      onChange={(event) =>
                        setResetPasswordsByUser((currentValues) => ({
                          ...currentValues,
                          [user.id]: event.target.value
                        }))
                      }
                      className="min-h-10 rounded-lg border-2 border-slate-800 bg-white px-3 text-xs font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => void handleResetPassword(user)}
                    className="min-h-10 rounded-lg border-2 border-slate-900 bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500"
                  >
                    Redefinir senha
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
