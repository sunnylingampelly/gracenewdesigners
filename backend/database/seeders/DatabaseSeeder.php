<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Core seeders are safe for every environment. The fictional demo catalogue only runs locally
     * or when SEED_DEMO=true, so fixtures never become production inventory by accident.
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            AdminUserSeeder::class,
            CatalogFoundationSeeder::class,
            ContentSeeder::class,
        ]);

        if (app()->environment('local') || filter_var(env('SEED_DEMO', false), FILTER_VALIDATE_BOOL)) {
            $this->call(DemoCatalogSeeder::class);
        }

        $this->call(HomepageSeeder::class);
    }
}
