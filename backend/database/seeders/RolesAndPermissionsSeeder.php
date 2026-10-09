<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Support\Permissions;
use Illuminate\Database\Seeder;

/**
 * Idempotent: safe to re-run after adding permissions in App\Support\Permissions.
 */
class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Permissions::ALL as $group => $permissions) {
            foreach ($permissions as $slug => $name) {
                Permission::query()->updateOrCreate(['slug' => $slug], ['name' => $name, 'group' => $group]);
            }
        }

        foreach (Permissions::ROLES as $slug => $definition) {
            $role = Role::query()->updateOrCreate(['slug' => $slug], [
                'name' => $definition['name'],
                'description' => $definition['description'],
                'is_system' => true,
            ]);
            // Only set grants on first creation so owner customisations survive re-seeding.
            if ($role->wasRecentlyCreated || $slug === 'owner') {
                $role->permissions()->sync(Permission::query()->whereIn('slug', Permissions::forRole($slug))->pluck('id'));
            }
        }
    }
}
