<?php
namespace Database\Seeders;

use App\Models\Category;
use App\Models\Collection;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Roles
        $roles = [
            ['name' => 'super_admin',  'display_name' => 'Super Admin',        'permissions' => ['*']],
            ['name' => 'manager',      'display_name' => 'Store Manager',       'permissions' => ['view_cost_price', 'approve_discount', 'approve_adjustment', 'approve_return', 'export_reports', 'view_reports']],
            ['name' => 'sales',        'display_name' => 'Sales Staff',         'permissions' => ['create_bill', 'collect_payment', 'view_leads', 'create_lead']],
            ['name' => 'storekeeper',  'display_name' => 'Inventory / Storekeeper', 'permissions' => ['create_grn', 'view_stock']],
            ['name' => 'accounts',     'display_name' => 'Accounts / Finance',  'permissions' => ['view_reports', 'export_reports', 'view_cost_price', 'reconcile_payment']],
            ['name' => 'editor',       'display_name' => 'Catalogue Editor',    'permissions' => ['manage_catalogue']],
            ['name' => 'auditor',      'display_name' => 'Auditor',             'permissions' => ['view_audit_log', 'view_reports']],
        ];

        foreach ($roles as $r) {
            Role::updateOrCreate(['name' => $r['name']], $r);
        }

        // Super admin user
        $adminRole = Role::where('name', 'super_admin')->first();
        User::updateOrCreate(['email' => 'admin@gracenewdesigners.com'], [
            'role_id'  => $adminRole->id,
            'name'     => 'Admin',
            'password' => Hash::make('changeme123'),
            'is_active'=> true,
        ]);

        // Categories
        $categories = [
            ['name' => 'Sherwanis',       'slug' => 'sherwanis',        'type' => 'indian'],
            ['name' => 'Bandhgala Suits',  'slug' => 'bandhgala-suits',  'type' => 'indian'],
            ['name' => 'Kurta Sets',       'slug' => 'kurta-sets',       'type' => 'indian'],
            ['name' => 'Nehru Jackets',    'slug' => 'nehru-jackets',    'type' => 'indian'],
            ['name' => 'Indo-Western',     'slug' => 'indo-western',     'type' => 'indian'],
            ['name' => 'Western Suits',    'slug' => 'western-suits',    'type' => 'western'],
            ['name' => 'Tuxedos',          'slug' => 'tuxedos',          'type' => 'western'],
            ['name' => 'Blazers',          'slug' => 'blazers',          'type' => 'western'],
            ['name' => 'Formalwear',       'slug' => 'formalwear',       'type' => 'western'],
            ['name' => 'Smart Casual',     'slug' => 'smart-casual',     'type' => 'western'],
            ['name' => 'Accessories',      'slug' => 'accessories',      'type' => 'accessories'],
        ];

        foreach ($categories as $i => $cat) {
            Category::updateOrCreate(['slug' => $cat['slug']], array_merge($cat, ['sort_order' => $i]));
        }

        // Sample collection
        Collection::updateOrCreate(['slug' => 'wedding-2026'], [
            'name'        => 'Wedding Collection 2026',
            'season'      => 'Wedding 2026',
            'description' => 'Curated sherwanis, bandhgalas and occasion wear for the groom and his guests.',
            'is_featured' => true,
            'is_active'   => true,
        ]);

        $this->command->info('Seed complete. Login: admin@gracenewdesigners.com / changeme123');
    }
}
