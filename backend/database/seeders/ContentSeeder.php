<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Department;
use App\Models\NavigationMenu;
use App\Models\Occasion;
use App\Models\Page;
use Illuminate\Database\Seeder;

/**
 * Starter pages and menus. Copy is deliberately neutral (no invented history, numbers or awards).
 * Policy pages that need real business terms are created as unpublished drafts.
 */
class ContentSeeder extends Seeder
{
    public function run(): void
    {
        $this->pages();
        $this->menus();
    }

    private function pages(): void
    {
        $pages = [
            'our-story' => ['Our Story', 'story', 'published', true,
                'Modern Indian couture, made for the moments you will remember.',
                '<h2>Modern Indian Couture, Timeless Grace</h2><p>Grace New Designers creates bridal couture, occasionwear and ethnic luxury clothing for women and men. Each piece brings together considered silhouettes, fine fabrics and hand-finished detail.</p><p>Many designs can be made to your measurements. Our team guides you through sizing, fabric and timelines personally on WhatsApp or during a consultation.</p><p><em>Editor’s note: replace this introduction with the studio’s own story before launch.</em></p>'],
            'contact' => ['Contact', 'contact', 'published', true,
                'Speak with our team about a design, a fitting or a consultation.',
                '<p>We are happy to help with availability, sizing, custom measurements and delivery. The quickest way to reach us is WhatsApp; you can also send a message using the form on this page.</p>'],
            'privacy-policy' => ['Privacy Policy', 'policy', 'published', true,
                'How enquiry information is used on this website.',
                '<h2>What we collect</h2><p>When you start an enquiry we record the designs, sizes and colours you selected so our team can respond. Contact details and measurements are stored only if you choose to provide them and agree to this notice.</p><h2>WhatsApp</h2><p>Enquiry buttons open WhatsApp with a pre-filled message. The message contains product details and an enquiry reference — not your personal information. Conversations on WhatsApp are governed by WhatsApp’s own terms.</p><h2>Analytics</h2><p>Measurement cookies are only used if you accept them. We never send phone numbers or other personal details to analytics providers.</p><h2>Retention and your choices</h2><p>Personal details attached to enquiries are deleted after a fixed retention period. You may ask us to delete your information at any time.</p><p><em>Editor’s note: review this policy with your legal adviser and add the business’s legal name and contact address before launch.</em></p>'],
            'terms' => ['Terms of Use', 'policy', 'draft', true, 'Terms governing use of this website.',
                '<p><em>Draft — to be provided by Grace New Designers before launch.</em></p>'],
            'shipping-and-delivery' => ['Shipping & Delivery', 'policy', 'draft', true, 'Delivery timelines and shipping options.',
                '<p><em>Draft — add the studio’s confirmed shipping regions, carriers and timelines before publishing.</em></p>'],
            'returns-and-exchanges' => ['Returns & Exchanges', 'policy', 'draft', true, 'Our approach to returns, alterations and exchanges.',
                '<p><em>Draft — add the studio’s confirmed returns, alterations and exchange policy before publishing.</em></p>'],
            'size-guide' => ['Size Guide', 'default', 'published', true, 'How to measure for the perfect fit.',
                '<h2>Taking your measurements</h2><p>Measure over light clothing with a soft tape held snug but not tight.</p><ul><li><strong>Chest</strong> — around the fullest part under the arms.</li><li><strong>Waist</strong> — at your natural waistline or where you wear your trousers.</li><li><strong>Shoulder</strong> — seam to seam across the back.</li><li><strong>Sleeve Length</strong> — from shoulder seam to wrist bone.</li></ul><p>Each product page shows the size chart for that design. If you are between sizes, choose <strong>Custom Size</strong> or request a fitting consultation and our team will guide you.</p>'],
        ];

        foreach ($pages as $slug => [$title, $template, $status, $footer, $excerpt, $body]) {
            Page::query()->firstOrCreate(['slug' => $slug], [
                'title' => $title, 'template' => $template, 'status' => $status, 'show_in_footer' => $footer,
                'excerpt' => $excerpt, 'body' => $body, 'published_at' => $status === 'published' ? now() : null,
                'is_indexable' => $template !== 'policy',
            ]);
        }
    }

    private function menus(): void
    {
        $header = NavigationMenu::query()->firstOrCreate(['location' => 'header'], ['name' => 'Main navigation']);
        if ($header->items()->exists()) {
            return;
        }

        $item = fn (NavigationMenu $menu, array $attrs, ?int $parent = null, int $sort = 0) => $menu->items()->create([
            'parent_id' => $parent, 'sort_order' => $sort, 'is_active' => true, ...$attrs,
        ]);
        $page = fn (string $slug) => Page::query()->where('slug', $slug)->value('id');

        $sort = 0;
        $item($header, ['label' => 'New Arrivals', 'link_type' => 'route', 'url' => 'new-arrivals'], null, $sort++);

        foreach (Department::query()->orderBy('sort_order')->get() as $department) {
            if ($department->slug === 'accessories') {
                continue;
            }
            $root = $item($header, ['label' => $department->name, 'link_type' => 'department', 'link_id' => $department->id], null, $sort++);
            $s = 0;
            foreach (Category::query()->where('department_id', $department->id)->whereNull('parent_id')->orderBy('sort_order')->get() as $category) {
                $item($header, ['label' => $category->name, 'link_type' => 'category', 'link_id' => $category->id, 'group_heading' => 'Shop by Category'], $root->id, $s++);
            }
            $occasionSlugs = ['wedding', 'reception', 'engagement', 'sangeet', 'festive-occasions', 'cocktail-parties'];
            foreach (Occasion::query()->whereIn('slug', $occasionSlugs)->orderBy('sort_order')->get() as $occasion) {
                $item($header, ['label' => $occasion->name, 'link_type' => 'occasion', 'link_id' => $occasion->id, 'group_heading' => 'Shop by Occasion'], $root->id, $s++);
            }
            $item($header, ['label' => 'View all '.$department->name, 'link_type' => 'department', 'link_id' => $department->id, 'group_heading' => 'Discover'], $root->id, $s++);
        }

        $accessories = Department::query()->where('slug', 'accessories')->first();
        $item($header, ['label' => 'Collections', 'link_type' => 'route', 'url' => 'collections'], null, $sort++);
        if ($accessories) {
            $item($header, ['label' => 'Accessories', 'link_type' => 'department', 'link_id' => $accessories->id], null, $sort++);
        }
        $item($header, ['label' => 'Lookbook', 'link_type' => 'route', 'url' => 'lookbook'], null, $sort++);
        $item($header, ['label' => 'Our Story', 'link_type' => 'page', 'link_id' => $page('our-story')], null, $sort++);

        $shop = NavigationMenu::query()->firstOrCreate(['location' => 'footer_shop'], ['name' => 'Footer — Shop']);
        $s = 0;
        $item($shop, ['label' => 'New Arrivals', 'link_type' => 'route', 'url' => 'new-arrivals'], null, $s++);
        foreach (Department::query()->orderBy('sort_order')->get() as $department) {
            $item($shop, ['label' => $department->name, 'link_type' => 'department', 'link_id' => $department->id], null, $s++);
        }
        $item($shop, ['label' => 'Collections', 'link_type' => 'route', 'url' => 'collections'], null, $s++);
        $item($shop, ['label' => 'Shop by Occasion', 'link_type' => 'route', 'url' => 'occasions'], null, $s++);

        $house = NavigationMenu::query()->firstOrCreate(['location' => 'footer_house'], ['name' => 'Footer — The House']);
        $item($house, ['label' => 'Our Story', 'link_type' => 'page', 'link_id' => $page('our-story')], null, 0);
        $item($house, ['label' => 'Lookbook', 'link_type' => 'route', 'url' => 'lookbook'], null, 1);
        $item($house, ['label' => 'Book a Consultation', 'link_type' => 'route', 'url' => 'consultation'], null, 2);
        $item($house, ['label' => 'Contact', 'link_type' => 'route', 'url' => 'contact'], null, 3);

        $help = NavigationMenu::query()->firstOrCreate(['location' => 'footer_help'], ['name' => 'Footer — Client Care']);
        $s = 0;
        foreach (['size-guide', 'shipping-and-delivery', 'returns-and-exchanges', 'privacy-policy', 'terms'] as $slug) {
            if ($id = $page($slug)) {
                $item($help, ['label' => Page::query()->find($id)->title, 'link_type' => 'page', 'link_id' => $id], null, $s++);
            }
        }

        NavigationMenu::query()->firstOrCreate(['location' => 'mobile_secondary'], ['name' => 'Mobile drawer — secondary links']);
    }
}
