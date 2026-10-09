<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class TeamController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    /** Lightweight list for assignment dropdowns (any admin user may see team names). */
    public function assignees(): JsonResponse
    {
        return response()->json(['data' => User::query()->where('is_active', true)->orderBy('name')->get(['id', 'name'])]);
    }

    public function users(): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        return response()->json(['data' => User::query()->with('roles:id,slug,name')->orderBy('name')->get()->map(fn (User $u) => [
            ...$u->only(['id', 'name', 'email', 'phone', 'is_active']),
            'roles' => $u->roles->map->only(['id', 'slug', 'name']),
            'two_factor_enabled' => $u->hasTwoFactorEnabled(),
            'last_login_at' => $u->last_login_at?->toIso8601String(),
        ])]);
    }

    public function storeUser(Request $request): JsonResponse
    {
        $this->authorize('create', User::class);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email', 'max:190', Rule::unique('users')->whereNull('deleted_at')],
            'phone' => ['nullable', 'string', 'max:32'],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
            'password' => ['nullable', PasswordRule::defaults()],
            'send_invite' => ['sometimes', 'boolean'],
        ]);
        $this->guardOwnerRole($request->user(), $data['role_ids']);

        $user = DB::transaction(function () use ($data) {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => Str::lower($data['email']),
                'phone' => $data['phone'] ?? null,
                // Without a password the user sets one through the reset link.
                'password' => $data['password'] ?? Str::password(40),
                'is_active' => true,
            ]);
            $user->roles()->sync($data['role_ids']);

            return $user;
        });
        if (($data['send_invite'] ?? true) || empty($data['password'])) {
            Password::sendResetLink(['email' => $user->email]);
        }
        $this->logger->log('user.created', "Added team member {$user->name}", $user);

        return response()->json(['data' => $user->load('roles')], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'email' => ['sometimes', 'email', 'max:190', Rule::unique('users')->ignore($user->id)->whereNull('deleted_at')],
            'phone' => ['nullable', 'string', 'max:32'],
            'is_active' => ['sometimes', 'boolean'],
            'role_ids' => ['sometimes', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'exists:roles,id'],
        ]);
        if ($user->id === $request->user()->id && (($data['is_active'] ?? true) === false || isset($data['role_ids']))) {
            throw ValidationException::withMessages(['user' => 'You cannot deactivate yourself or change your own roles.']);
        }
        if (isset($data['role_ids'])) {
            $this->guardOwnerRole($request->user(), $data['role_ids']);
            $this->guardLastOwner($user, $data['role_ids']);
        }

        DB::transaction(function () use ($user, $data) {
            $user->fill(collect($data)->except('role_ids')->all())->save();
            if (isset($data['role_ids'])) {
                $user->roles()->sync($data['role_ids']);
            }
            if (($data['is_active'] ?? true) === false) {
                DB::table('sessions')->where('user_id', $user->id)->delete();
                $user->tokens()->delete();
            }
        });
        $this->logger->log('user.updated', "Updated team member {$user->name}", $user);

        return response()->json(['data' => $user->load('roles')]);
    }

    public function destroyUser(Request $request, User $user): JsonResponse
    {
        $this->authorize('delete', $user);
        $this->guardLastOwner($user, []);
        DB::table('sessions')->where('user_id', $user->id)->delete();
        $user->delete();
        $this->logger->log('user.deleted', "Removed team member {$user->name}", $user);

        return response()->json(null, 204);
    }

    public function roles(): JsonResponse
    {
        abort_unless(auth()->user()->hasPermission('users.manage'), 403);

        return response()->json([
            'data' => Role::query()->with('permissions:id,slug')->withCount('users')->get()->map(fn (Role $r) => [
                ...$r->only(['id', 'name', 'slug', 'description', 'is_system', 'requires_mfa']),
                'users_count' => $r->users_count,
                'permissions' => $r->slug === 'owner' ? Permissions::slugs() : $r->permissions->pluck('slug'),
            ]),
            'meta' => ['permission_groups' => Permissions::ALL],
        ]);
    }

    public function updateRole(Request $request, Role $role): JsonResponse
    {
        abort_unless($request->user()->isOwner(), 403, 'Only owners can change role permissions.');
        $data = $request->validate([
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in(Permissions::slugs())],
            'requires_mfa' => ['sometimes', 'boolean'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);
        if ($role->slug === 'owner' && isset($data['permissions'])) {
            throw ValidationException::withMessages(['permissions' => 'The Owner role always has every permission.']);
        }
        DB::transaction(function () use ($role, $data) {
            $role->fill(collect($data)->only(['requires_mfa', 'description'])->all())->save();
            if (isset($data['permissions'])) {
                $role->permissions()->sync(Permission::query()->whereIn('slug', $data['permissions'])->pluck('id'));
            }
        });
        $this->logger->log('role.updated', "Updated role {$role->name}", $role, ['permissions' => $data['permissions'] ?? null, 'requires_mfa' => $data['requires_mfa'] ?? null]);

        return $this->roles();
    }

    public function activity(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('activity.view'), 403);
        $filters = $request->validate([
            'user_id' => ['nullable', 'integer'],
            'subject_type' => ['nullable', 'string', 'max:60'],
            'action' => ['nullable', 'string', 'max:60'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);
        $page = ActivityLog::query()->with('user:id,name')
            ->when($filters['user_id'] ?? null, fn ($q, $id) => $q->where('user_id', $id))
            ->when($filters['subject_type'] ?? null, fn ($q, $t) => $q->where('subject_type', $t))
            ->when($filters['action'] ?? null, fn ($q, $a) => $q->where('action', 'like', $a.'%'))
            ->when($filters['q'] ?? null, fn ($q, $t) => $q->where('description', 'like', "%{$t}%"))
            ->latest('id')->paginate(50)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (ActivityLog $l) => [
                'id' => $l->id, 'action' => $l->action, 'description' => $l->description,
                'subject_type' => $l->subject_type, 'subject_id' => $l->subject_id, 'changes' => $l->changes,
                'user' => $l->user?->name ?? 'System', 'created_at' => $l->created_at?->toIso8601String(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    private function guardOwnerRole(User $actor, array $roleIds): void
    {
        $ownerId = Role::query()->where('slug', 'owner')->value('id');
        if (in_array($ownerId, array_map('intval', $roleIds), true) && ! $actor->isOwner()) {
            throw ValidationException::withMessages(['role_ids' => 'Only an owner can grant the Owner role.']);
        }
    }

    private function guardLastOwner(User $user, array $newRoleIds): void
    {
        $ownerRole = Role::query()->where('slug', 'owner')->first();
        if (! $ownerRole || ! $user->isOwner() || in_array($ownerRole->id, array_map('intval', $newRoleIds), true)) {
            return;
        }
        $otherActiveOwners = $ownerRole->users()->where('users.id', '!=', $user->id)
            ->where('is_active', true)->whereNull('deleted_at')->count();
        if ($otherActiveOwners === 0) {
            throw ValidationException::withMessages(['role_ids' => 'There must always be at least one active owner.']);
        }
    }
}
