<?php

namespace App\Support;

/**
 * Canonical permission catalogue and default role grants.
 * Seeded into the permissions/roles tables; enforcement happens server-side via policies and middleware.
 */
final class Permissions
{
    public const ALL = [
        'catalog' => [
            'products.view' => 'View products',
            'products.manage' => 'Create and edit products',
            'products.publish' => 'Publish, archive and delete products',
            'products.import' => 'Import and export products',
            'taxonomy.manage' => 'Manage departments, categories, collections, occasions, tags',
            'attributes.manage' => 'Manage attributes, options and size charts',
        ],
        'media' => [
            'media.view' => 'View media library',
            'media.manage' => 'Upload and manage media',
        ],
        'sales' => [
            'enquiries.view' => 'View enquiries',
            'enquiries.manage' => 'Update, assign and annotate enquiries',
            'enquiries.export' => 'Export enquiries',
            'orders.view' => 'View orders',
            'orders.manage' => 'Create and update orders',
            'customers.view' => 'View customers and contacts',
            'customers.manage' => 'Edit, anonymize and delete customers',
        ],
        'content' => [
            'content.manage' => 'Manage homepage, pages, lookbooks, testimonials',
            'navigation.manage' => 'Manage navigation menus',
            'seo.manage' => 'Manage SEO settings and redirects',
        ],
        'system' => [
            'reports.view' => 'View dashboard and reports',
            'settings.manage' => 'Manage brand and site settings',
            'users.manage' => 'Manage team members and roles',
            'activity.view' => 'View activity logs',
        ],
    ];

    public const ROLES = [
        'owner' => [
            'name' => 'Owner',
            'description' => 'Full access, including team management.',
            'permissions' => '*',
        ],
        'administrator' => [
            'name' => 'Administrator',
            'description' => 'Manages catalogue, content, sales and settings. Cannot manage team members.',
            'permissions' => '*',
        ],
        'catalog-manager' => [
            'name' => 'Catalog Manager',
            'description' => 'Manages products, taxonomy and media.',
            'permissions' => [
                'products.view', 'products.manage', 'products.publish', 'products.import',
                'taxonomy.manage', 'attributes.manage', 'media.view', 'media.manage', 'reports.view',
            ],
        ],
        'enquiry-manager' => [
            'name' => 'Enquiry Manager',
            'description' => 'Handles enquiries, customers and orders.',
            'permissions' => [
                'products.view', 'enquiries.view', 'enquiries.manage', 'enquiries.export',
                'orders.view', 'orders.manage', 'customers.view', 'customers.manage', 'reports.view',
            ],
        ],
        'content-editor' => [
            'name' => 'Content Editor',
            'description' => 'Manages homepage, pages, lookbooks, menus and SEO.',
            'permissions' => [
                'products.view', 'media.view', 'media.manage', 'content.manage', 'navigation.manage', 'seo.manage',
            ],
        ],
    ];

    /** @return list<string> */
    public static function slugs(): array
    {
        return array_merge(...array_map('array_keys', array_values(self::ALL)));
    }

    /** @return list<string> */
    public static function forRole(string $role): array
    {
        $grants = self::ROLES[$role]['permissions'] ?? [];

        if ($grants !== '*') {
            return $grants;
        }

        return $role === 'owner'
            ? self::slugs()
            : array_values(array_diff(self::slugs(), ['users.manage']));
    }
}
