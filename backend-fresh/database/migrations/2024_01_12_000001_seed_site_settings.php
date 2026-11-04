<?php
use Illuminate\Database\Migrations\Migration;
use App\Models\SiteSetting;

return new class extends Migration {
    public function up(): void {
        $settings = [
            // ── BRANDING ──────────────────────────────────────────────────────
            ['key'=>'brand_name',           'value'=>'Grace New Designers',                             'type'=>'text',     'label'=>'Brand Name',                                   'group'=>'branding'],
            ['key'=>'brand_tagline',        'value'=>'Designer Menswear · Made to Measure',             'type'=>'text',     'label'=>'Brand Tagline',                                'group'=>'branding'],
            ['key'=>'brand_logo',           'value'=>null,                                              'type'=>'image',    'label'=>'Logo Image',                                   'group'=>'branding'],
            ['key'=>'brand_about',          'value'=>'Designer menswear for every occasion — custom-fitted, handcrafted, made for you.', 'type'=>'textarea','label'=>'About (footer & meta)', 'group'=>'branding'],
            ['key'=>'copyright_text',       'value'=>'© 2026 Grace New Designers',                     'type'=>'text',     'label'=>'Copyright Text',                               'group'=>'branding'],
            ['key'=>'favicon',              'value'=>null,                                              'type'=>'image',    'label'=>'Favicon',                                      'group'=>'branding'],
            // ── CONTACT ───────────────────────────────────────────────────────
            ['key'=>'contact_phone',        'value'=>'918181816202',                                    'type'=>'text',     'label'=>'Phone Number (digits only, with country code)', 'group'=>'contact'],
            ['key'=>'contact_phone_display','value'=>'+91 81818 16202',                                 'type'=>'text',     'label'=>'Phone Display (shown to customers)',            'group'=>'contact'],
            ['key'=>'contact_whatsapp',     'value'=>'918181816202',                                    'type'=>'text',     'label'=>'WhatsApp Number (digits only)',                 'group'=>'contact'],
            ['key'=>'contact_email',        'value'=>'',                                                'type'=>'text',     'label'=>'Email Address',                                'group'=>'contact'],
            ['key'=>'contact_address',      'value'=>'Raj Towers, B-1076, Gandhi Nagar Road, Opp. Captain Cook Restaurant, Beside Metro Pillar, Musheerabad, Bakaram, Kavadiguda, Hyderabad, Telangana 500020', 'type'=>'textarea','label'=>'Store Address','group'=>'contact'],
            ['key'=>'store_hours',          'value'=>'Mon–Sat · 10am–7pm',                             'type'=>'text',     'label'=>'Store Hours',                                  'group'=>'contact'],
            ['key'=>'store_map_url',        'value'=>'',                                                'type'=>'text',     'label'=>'Google Maps URL',                              'group'=>'contact'],
            // ── HERO ─────────────────────────────────────────────────────────
            ['key'=>'hero_badge',           'value'=>'Designer Menswear · Made to Measure',             'type'=>'text',     'label'=>'Hero Badge Text',                              'group'=>'hero'],
            ['key'=>'hero_title',           'value'=>'Dressed for',                                     'type'=>'text',     'label'=>'Hero Title (line 1)',                           'group'=>'hero'],
            ['key'=>'hero_title_accent',    'value'=>'every occasion',                                  'type'=>'text',     'label'=>'Hero Title (line 2, accent)',                   'group'=>'hero'],
            ['key'=>'hero_subtitle',        'value'=>'Bespoke suits, sherwanis and occasion wear — crafted to your measurements and personality.', 'type'=>'textarea','label'=>'Hero Subtitle','group'=>'hero'],
            ['key'=>'hero_cta',             'value'=>'View Collections',                                'type'=>'text',     'label'=>'Hero CTA Button Text',                         'group'=>'hero'],
            ['key'=>'hero_cta_secondary',   'value'=>'Call Us',                                         'type'=>'text',     'label'=>'Hero Secondary Button',                        'group'=>'hero'],
            ['key'=>'hero_image',           'value'=>null,                                              'type'=>'image',    'label'=>'Hero Background Image',                        'group'=>'hero'],
            // ── HOME ─────────────────────────────────────────────────────────
            ['key'=>'featured_tagline',     'value'=>'Curated for him',                                 'type'=>'text',     'label'=>'Featured Section Tagline',                     'group'=>'home'],
            ['key'=>'featured_title',       'value'=>'The Collection',                                  'type'=>'text',     'label'=>'Featured Section Title',                       'group'=>'home'],
            ['key'=>'featured_cta',         'value'=>'View all →',                                      'type'=>'text',     'label'=>'Featured Section CTA',                         'group'=>'home'],
            ['key'=>'categories_strip',     'value'=>'Indian Wear,Sherwanis,Western Suits,Wedding,Festive,Made to Measure', 'type'=>'text','label'=>'Category Strip (comma-separated)','group'=>'home'],
            ['key'=>'craft_tagline',        'value'=>'Our Process',                                     'type'=>'text',     'label'=>'Process Section Tagline',                      'group'=>'home'],
            ['key'=>'craft_title',          'value'=>'Every garment made for you',                      'type'=>'text',     'label'=>'Process Section Title',                        'group'=>'home'],
            ['key'=>'craft_body',           'value'=>"We don't sell off the rack. Every piece is custom-fitted to your body and tailored to your occasion.", 'type'=>'textarea','label'=>'Process Section Body','group'=>'home'],
            ['key'=>'craft_image',          'value'=>null,                                              'type'=>'image',    'label'=>'Process Section Image',                        'group'=>'home'],
            ['key'=>'cta_title',            'value'=>'Ready for your perfect fit?',                     'type'=>'text',     'label'=>'CTA Banner Title',                             'group'=>'home'],
            ['key'=>'cta_body',             'value'=>'Send us a message on WhatsApp or call us directly. Tell us your occasion and style — we respond within hours.', 'type'=>'textarea','label'=>'CTA Banner Body','group'=>'home'],
            ['key'=>'cta_wa_button',        'value'=>'Chat on WhatsApp',                                'type'=>'text',     'label'=>'CTA WhatsApp Button Text',                     'group'=>'home'],
            ['key'=>'cta_phone_button',     'value'=>'Call Now',                                        'type'=>'text',     'label'=>'CTA Phone Button Text',                        'group'=>'home'],
            ['key'=>'cta_footnote',         'value'=>'Mon–Sat, 10am–7pm · Hyderabad',                  'type'=>'text',     'label'=>'CTA Footnote',                                 'group'=>'home'],
            ['key'=>'gallery_tagline',      'value'=>'Our work',                                        'type'=>'text',     'label'=>'Gallery Tagline',                              'group'=>'home'],
            ['key'=>'gallery_title',        'value'=>'Gallery',                                         'type'=>'text',     'label'=>'Gallery Title',                                'group'=>'home'],
            ['key'=>'gallery_cta',          'value'=>'Browse all →',                                    'type'=>'text',     'label'=>'Gallery CTA',                                  'group'=>'home'],
            // ── COLLECTIONS ───────────────────────────────────────────────────
            ['key'=>'collections_badge',    'value'=>'Handcrafted · Made to Measure',                   'type'=>'text',     'label'=>'Collections Page Badge',                       'group'=>'collections'],
            ['key'=>'collections_title',    'value'=>'Our Catalogue',                                   'type'=>'text',     'label'=>'Collections Page Title',                       'group'=>'collections'],
            ['key'=>'collections_subtitle', 'value'=>'Every piece crafted for your occasion and personality.', 'type'=>'textarea','label'=>'Collections Subtitle',                  'group'=>'collections'],
            ['key'=>'collections_banner',   'value'=>null,                                              'type'=>'image',    'label'=>'Collections Banner Image',                     'group'=>'collections'],
            ['key'=>'collections_cta_title','value'=>'Want something custom?',                          'type'=>'text',     'label'=>'Collections CTA Title',                        'group'=>'collections'],
            ['key'=>'collections_cta_body', 'value'=>'All our garments are made to your exact measurements. Book a consultation.', 'type'=>'textarea','label'=>'Collections CTA Body','group'=>'collections'],
            // ── FOOTER ────────────────────────────────────────────────────────
            ['key'=>'footer_tagline',       'value'=>'Designer menswear for every occasion — custom-fitted, handcrafted, made for you.', 'type'=>'textarea','label'=>'Footer Tagline','group'=>'footer'],
            ['key'=>'footer_col2_title',    'value'=>'Collections',                                     'type'=>'text',     'label'=>'Footer Column 2 Heading',                      'group'=>'footer'],
            ['key'=>'footer_col3_title',    'value'=>'Services',                                        'type'=>'text',     'label'=>'Footer Column 3 Heading',                      'group'=>'footer'],
            ['key'=>'footer_services',      'value'=>'Made to Measure,Bespoke Tailoring,Alterations,Occasion Wear', 'type'=>'textarea','label'=>'Footer Services (comma-separated)','group'=>'footer'],
            ['key'=>'footer_col4_title',    'value'=>'Contact',                                         'type'=>'text',     'label'=>'Footer Column 4 Heading',                      'group'=>'footer'],
            // ── SEO ───────────────────────────────────────────────────────────
            ['key'=>'seo_title',            'value'=>'Grace New Designers — Bespoke Menswear Hyderabad','type'=>'text',     'label'=>'SEO Page Title',                               'group'=>'seo'],
            ['key'=>'seo_description',      'value'=>'Bespoke suits, sherwanis and occasion wear — custom-fitted, handcrafted in Hyderabad.', 'type'=>'textarea','label'=>'SEO Meta Description','group'=>'seo'],
            ['key'=>'seo_og_image',         'value'=>null,                                              'type'=>'image',    'label'=>'Social Share Image (OG Image)',                 'group'=>'seo'],
            ['key'=>'seo_keywords',         'value'=>'bespoke menswear, sherwanis, suits, hyderabad, made to measure', 'type'=>'text','label'=>'SEO Keywords',                       'group'=>'seo'],
            // ── GENERAL ───────────────────────────────────────────────────────
            ['key'=>'announcement_text',    'value'=>'',                                                'type'=>'text',     'label'=>'Announcement Bar Text (leave blank to hide)',  'group'=>'general'],
            ['key'=>'maintenance_mode',     'value'=>'0',                                               'type'=>'boolean',  'label'=>'Maintenance Mode',                             'group'=>'general'],
        ];

        foreach ($settings as $s) {
            SiteSetting::updateOrCreate(['key' => $s['key']], $s);
        }
    }

    public function down(): void {
        // Settings are intentional data — don't drop on rollback
    }
};
