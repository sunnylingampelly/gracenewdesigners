"use client";

import { Lock, Pencil, ShieldCheck, ShieldOff, Trash2, UserPlus } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { RequirePermission } from "@/components/admin/guard";
import { Badge, Button, Card, Checkbox, DataTable, EmptyState, ErrorNotice, Field, Input, Modal, MultiCheck, PageHeader, Spinner, Switch, Tabs, useConfirm, type Column } from "@/components/admin/ui";
import { useAuth } from "@/lib/admin/auth";
import { adminApi, useAdminMutation, useAdminQuery, useUnsavedChangesWarning, useUrlState } from "@/lib/admin/hooks";
import { ApiRequestError } from "@/lib/api-client";
import { formatDateTime, relativeTime } from "@/lib/utils";

type Member = { id: number; name: string; email: string; phone: string | null; is_active: boolean; roles: { id: number; slug: string; name: string }[]; two_factor_enabled: boolean; last_login_at: string | null };
type Role = { id: number; name: string; slug: string; description: string | null; is_system: boolean; requires_mfa: boolean; users_count: number; permissions: string[] };
type RolesResponse = { data: Role[]; meta: { permission_groups: Record<string, Record<string, string>> } };

const USERS_KEY = ["admin", "/admin/users"];
const ROLES_KEY = ["admin", "/admin/roles"];

export default function TeamPage() {
  return (
    <RequirePermission permission="users.manage">
      <PageHeader title="Team & roles" description="Invite colleagues, assign roles and decide what each role can do. Permissions are enforced by the server on every request." />
      <Suspense fallback={<Spinner />}>
        <TeamTabs />
      </Suspense>
    </RequirePermission>
  );
}

function TeamTabs() {
  const [state, setState] = useUrlState({ tab: "members" });
  return (
    <div className="space-y-6">
      <Tabs tabs={[{ value: "members", label: "Team members" }, { value: "roles", label: "Roles & permissions" }]} active={state.tab} onChange={(tab) => setState({ tab })} />
      {state.tab === "roles" ? <RolesMatrix /> : <Members />}
    </div>
  );
}

// ---- Members ---------------------------------------------------------------------------------------

function Members() {
  const { user } = useAuth();
  const users = useAdminQuery<{ data: Member[] }>("/admin/users");
  const roles = useAdminQuery<RolesResponse>("/admin/roles");
  const [editing, setEditing] = useState<Member | "new" | null>(null);
  const { confirm, dialog } = useConfirm();

  const remove = async (m: Member) => {
    try {
      await adminApi.delete(`/admin/users/${m.id}`);
      toast.success(`${m.name} removed`);
      await users.refetch();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : "The team member could not be removed.");
    }
  };

  const columns: Column<Member>[] = [
    {
      key: "name",
      header: "Name",
      cell: (m) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{m.name}{m.id === user.id && <span className="ml-1.5 text-xs font-normal text-slate-500">(you)</span>}</p>
          <p className="truncate text-xs text-slate-500">{m.email}</p>
        </div>
      ),
    },
    { key: "roles", header: "Roles", cell: (m) => <div className="flex flex-wrap gap-1">{m.roles.length ? m.roles.map((r) => <Badge key={r.id} tone={r.slug === "owner" ? "violet" : "slate"}>{r.name}</Badge>) : <span className="text-xs text-slate-400">No role</span>}</div> },
    { key: "active", header: "Status", cell: (m) => (m.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Deactivated</Badge>) },
    {
      key: "2fa",
      header: "2FA",
      cell: (m) => (m.two_factor_enabled ? <span className="inline-flex items-center gap-1 text-xs text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> On</span> : <span className="inline-flex items-center gap-1 text-xs text-slate-500"><ShieldOff className="h-3.5 w-3.5" aria-hidden /> Off</span>),
    },
    { key: "login", header: "Last login", hideOnMobile: true, cell: (m) => <span className="text-xs text-slate-500" title={formatDateTime(m.last_login_at)}>{m.last_login_at ? relativeTime(m.last_login_at) : "Never"}</span> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      className: "text-right",
      cell: (m) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(m)} aria-label={`Edit ${m.name}`}><Pencil className="h-3.5 w-3.5" /></Button>
          {m.id !== user.id && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${m.name}`}
              onClick={() => confirm({ title: `Remove ${m.name}?`, description: "They are signed out immediately and can no longer access the admin. Their past activity stays in the log.", confirmLabel: "Remove", destructive: true, action: () => remove(m) })}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-700" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card padded={false} title="Team members" description="Rules: you can’t deactivate yourself or change your own roles; only owners can grant the Owner role; there must always be at least one active owner." actions={<Button size="sm" onClick={() => setEditing("new")}><UserPlus className="h-3.5 w-3.5" aria-hidden /> Add member</Button>}>
      {users.error ? (
        <div className="p-4"><ErrorNotice error={users.error} onRetry={() => users.refetch()} /></div>
      ) : (
        <DataTable columns={columns} rows={users.data?.data} loading={users.isLoading} rowKey={(m) => m.id} empty={<EmptyState title="No team members" />} />
      )}
      {editing && roles.data && <MemberModal member={editing === "new" ? null : editing} roles={roles.data.data} onClose={() => setEditing(null)} />}
      {editing && roles.isLoading && <Modal open onOpenChange={() => setEditing(null)} title="Loading roles"><Spinner /></Modal>}
      {editing && roles.error && <Modal open onOpenChange={() => setEditing(null)} title="Roles unavailable"><ErrorNotice error={roles.error} onRetry={() => roles.refetch()} /></Modal>}
      {dialog}
    </Card>
  );
}

function MemberModal({ member, roles, onClose }: { member: Member | null; roles: Role[]; onClose: () => void }) {
  const { user } = useAuth();
  const isSelf = member?.id === user.id;
  const actorIsOwner = user.roles.some((r) => r.slug === "owner");
  const [form, setForm] = useState({
    name: member?.name ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    is_active: member?.is_active ?? true,
    role_ids: member?.roles.map((r) => r.id) ?? [],
    password: "",
    send_invite: true,
  });
  const initialRoles = useMemo(() => (member?.roles.map((r) => r.id) ?? []).sort().join(","), [member]);

  const save = useAdminMutation(
    (body: Record<string, unknown>) => (member ? adminApi.patch(`/admin/users/${member.id}`, body) : adminApi.post("/admin/users", body)),
    {
      success: member ? "Team member updated" : form.password && !form.send_invite ? "Team member added" : "Team member added — an email to set their password has been sent",
      invalidate: [USERS_KEY, ROLES_KEY],
      onSuccess: onClose,
    },
  );

  const submit = () => {
    if (!form.role_ids.length) {
      save.setFieldErrors({ role_ids: ["Choose at least one role."] });
      return;
    }
    if (member) {
      const body: Record<string, unknown> = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null };
      if (!isSelf) {
        body.is_active = form.is_active;
        if ([...form.role_ids].sort().join(",") !== initialRoles) body.role_ids = form.role_ids;
      }
      save.mutate(body);
    } else {
      save.mutate({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, role_ids: form.role_ids, password: form.password || null, send_invite: form.password ? form.send_invite : true });
    }
  };

  const generalError = save.fieldError("user");
  const options = roles.map((r) => ({ value: r.id, label: r.name, hint: r.slug === "owner" && !actorIsOwner ? "owners only" : r.requires_mfa ? "requires 2FA" : undefined }));

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={member ? `Edit ${member.name}` : "Add team member"}
      description={member ? undefined : "By default they receive an email with a link to set their own password."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={submit}>{member ? "Save changes" : "Add member"}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {generalError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{generalError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="m-name" required error={save.fieldError("name")}>
            <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={150} autoComplete="off" invalid={!!save.fieldError("name")} />
          </Field>
          <Field label="Email" htmlFor="m-email" required error={save.fieldError("email")}>
            <Input id="m-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={190} autoComplete="off" invalid={!!save.fieldError("email")} />
          </Field>
          <Field label="Phone" htmlFor="m-phone" error={save.fieldError("phone")}>
            <Input id="m-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={32} />
          </Field>
        </div>
        <Field label="Roles" required error={save.fieldError("role_ids") ?? save.fieldError("role_ids.0")} hint={isSelf ? "You can’t change your own roles — ask another owner." : !actorIsOwner ? "Only owners can grant the Owner role." : "A member gets the combined permissions of all their roles."}>
          {isSelf ? (
            <div className="flex flex-wrap gap-1">{member?.roles.map((r) => <Badge key={r.id}>{r.name}</Badge>)}</div>
          ) : (
            <MultiCheck options={options} value={form.role_ids} onChange={(role_ids) => setForm({ ...form, role_ids })} searchable={false} />
          )}
        </Field>
        {member ? (
          <Switch
            checked={form.is_active}
            onCheckedChange={(is_active) => setForm({ ...form, is_active })}
            disabled={isSelf}
            label="Active"
            description={isSelf ? "You can’t deactivate yourself." : "Deactivated members are signed out immediately and cannot log in."}
          />
        ) : (
          <div className="space-y-3 rounded-md border border-slate-200 p-4">
            <Field label="Initial password (optional)" htmlFor="m-password" error={save.fieldError("password")} hint="Leave empty to let them choose their own via the emailed link (recommended).">
              <Input id="m-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" invalid={!!save.fieldError("password")} />
            </Field>
            {form.password && <Checkbox label="Also email a password-reset link" description="Recommended so they can replace the password you set." checked={form.send_invite} onChange={(e) => setForm({ ...form, send_invite: e.target.checked })} />}
          </div>
        )}
        <button type="submit" className="sr-only">Save</button>
      </form>
    </Modal>
  );
}

// ---- Roles matrix ----------------------------------------------------------------------------------

function RolesMatrix() {
  const { data, isLoading, error, refetch } = useAdminQuery<RolesResponse>("/admin/roles");
  if (isLoading) return <Spinner label="Loading roles" />;
  if (error || !data) return <ErrorNotice error={error} onRetry={() => refetch()} />;
  return <RolesEditor key={JSON.stringify(data.data.map((r) => [r.id, r.permissions, r.requires_mfa]))} roles={data.data} groups={data.meta.permission_groups} />;
}

function RolesEditor({ roles, groups }: { roles: Role[]; groups: Record<string, Record<string, string>> }) {
  const { user, refresh } = useAuth();
  const isOwner = user.roles.some((r) => r.slug === "owner");
  const [draft, setDraft] = useState(() => Object.fromEntries(roles.map((r) => [r.id, { permissions: [...r.permissions], requires_mfa: r.requires_mfa }])) as Record<number, { permissions: string[]; requires_mfa: boolean }>);
  const { confirm, dialog } = useConfirm();

  const changed = roles.filter((r) => {
    const d = draft[r.id];
    return d.requires_mfa !== r.requires_mfa || (r.slug !== "owner" && [...d.permissions].sort().join() !== [...r.permissions].sort().join());
  });
  useUnsavedChangesWarning(changed.length > 0);

  const save = useAdminMutation(
    async () => {
      for (const r of changed) {
        const d = draft[r.id];
        await adminApi.patch(`/admin/roles/${r.id}`, r.slug === "owner" ? { requires_mfa: d.requires_mfa } : { permissions: d.permissions, requires_mfa: d.requires_mfa });
      }
    },
    { success: "Roles updated", invalidate: [ROLES_KEY, USERS_KEY], onSuccess: () => refresh() },
  );

  const toggle = (roleId: number, perm: string) =>
    setDraft((d) => {
      const has = d[roleId].permissions.includes(perm);
      return { ...d, [roleId]: { ...d[roleId], permissions: has ? d[roleId].permissions.filter((p) => p !== perm) : [...d[roleId].permissions, perm] } };
    });

  const submit = () => {
    const mine = new Set(user.roles.map((r) => r.slug));
    const locksMeOut = !user.two_factor_enabled && changed.some((r) => mine.has(r.slug) && draft[r.id].requires_mfa && !r.requires_mfa);
    if (locksMeOut) {
      confirm({
        title: "Require 2FA for your own role?",
        description: "You haven’t set up two-factor authentication yet. After saving you’ll need to enrol from Account & security before using the rest of the admin.",
        confirmLabel: "Save anyway",
        action: () => save.mutateAsync(undefined),
      });
    } else save.mutate(undefined);
  };

  return (
    <Card
      padded={false}
      title="Roles & permissions"
      description={isOwner ? "Tick what each role may do. The Owner role always has every permission." : "Only owners can change role permissions. You can view them here."}
      actions={
        isOwner ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={!changed.length} onClick={() => setDraft(Object.fromEntries(roles.map((r) => [r.id, { permissions: [...r.permissions], requires_mfa: r.requires_mfa }])))}>Discard</Button>
            <Button size="sm" loading={save.isPending} disabled={!changed.length} onClick={submit}>Save{changed.length ? ` (${changed.length})` : ""}</Button>
          </div>
        ) : undefined
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Permissions granted to each role</caption>
          <thead className="border-b border-slate-200 bg-slate-50/80">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">Permission</th>
              {roles.map((r) => (
                <th key={r.id} scope="col" className="px-3 py-3 text-center align-bottom">
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-900">{r.slug === "owner" && <Lock className="h-3 w-3" aria-label="Read-only" />}{r.name}</span>
                    <span className="text-[11px] font-normal text-slate-500">{r.users_count} {r.users_count === 1 ? "member" : "members"}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200 bg-amber-50/40">
              <th scope="row" className="sticky left-0 z-10 bg-amber-50 px-4 py-2.5 text-left font-medium text-slate-800">
                Requires two-factor authentication
                <span className="block text-xs font-normal text-slate-500">Members must enrol before using the admin.</span>
              </th>
              {roles.map((r) => (
                <td key={r.id} className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-slate-900"
                    checked={draft[r.id].requires_mfa}
                    disabled={!isOwner}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.id]: { ...d[r.id], requires_mfa: e.target.checked } }))}
                    aria-label={`${r.name}: requires two-factor authentication`}
                  />
                </td>
              ))}
            </tr>
            {Object.entries(groups).map(([group, perms]) => (
              <GroupRows key={group} group={group} perms={perms} roles={roles} draft={draft} editable={isOwner} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </Card>
  );
}

function GroupRows({ group, perms, roles, draft, editable, onToggle }: { group: string; perms: Record<string, string>; roles: Role[]; draft: Record<number, { permissions: string[] }>; editable: boolean; onToggle: (roleId: number, perm: string) => void }) {
  return (
    <>
      <tr className="bg-slate-50/60">
        <th scope="colgroup" colSpan={roles.length + 1} className="sticky left-0 px-4 pt-4 pb-1.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">{group}</th>
      </tr>
      {Object.entries(perms).map(([slug, label]) => (
        <tr key={slug} className="border-b border-slate-100 hover:bg-slate-50/60">
          <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-normal text-slate-700">
            {label}
            <code className="ml-2 text-[11px] text-slate-400">{slug}</code>
          </th>
          {roles.map((r) => {
            const owner = r.slug === "owner";
            return (
              <td key={r.id} className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-slate-900"
                  checked={owner || draft[r.id].permissions.includes(slug)}
                  disabled={!editable || owner}
                  onChange={() => onToggle(r.id, slug)}
                  aria-label={`${r.name}: ${label}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
