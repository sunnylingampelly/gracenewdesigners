<?php

namespace App\Http\Resources\Admin;

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class CurrentUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->roles->map(fn ($r) => ['slug' => $r->slug, 'name' => $r->name])->values(),
            'permissions' => $this->isOwner() ? Permissions::slugs() : $this->permissionSlugs(),
            'two_factor_enabled' => $this->hasTwoFactorEnabled(),
            'two_factor_required' => $this->requiresTwoFactor(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
        ];
    }
}
