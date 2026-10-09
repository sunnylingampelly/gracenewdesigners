<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Creates the first owner account from ADMIN_EMAIL / ADMIN_PASSWORD.
 * In non-local environments a password must be supplied explicitly; nothing is hard-coded.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = Str::lower((string) env('ADMIN_EMAIL', 'owner@example.com'));
        $password = env('ADMIN_PASSWORD');

        if (! $password) {
            if (! app()->environment(['local', 'testing'])) {
                $this->command?->warn('ADMIN_PASSWORD is not set — skipping owner account creation.');

                return;
            }
            $password = 'Grace-Local-Dev-2026!';
            $this->command?->warn("Local owner account: {$email} / {$password} (change it after first sign-in).");
        }

        $user = User::query()->firstOrCreate(['email' => $email], [
            'name' => env('ADMIN_NAME', 'Studio Owner'),
            'password' => $password,
            'is_active' => true,
        ]);
        $user->roles()->syncWithoutDetaching(Role::query()->where('slug', 'owner')->pluck('id'));

        if (app()->environment('local')) {
            // Additional local-only accounts for exercising role permissions.
            foreach (['catalog-manager' => 'Catalog Manager', 'enquiry-manager' => 'Enquiry Manager', 'content-editor' => 'Content Editor'] as $slug => $name) {
                $member = User::query()->firstOrCreate(['email' => "{$slug}@example.com"], [
                    'name' => "{$name} (demo)", 'password' => 'Grace-Local-Dev-2026!', 'is_active' => true,
                ]);
                $member->roles()->syncWithoutDetaching(Role::query()->where('slug', $slug)->pluck('id'));
            }
        }
    }
}
