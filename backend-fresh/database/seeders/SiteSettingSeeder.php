<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use App\Models\SiteSetting;

class SiteSettingSeeder extends Seeder {
    public function run(): void {
        $settings = [
            ['key'=>'hero_title',        'value'=>'Dressed for',                         'type'=>'text',     'label'=>'Hero Title',           'group'=>'hero'],
            ['key'=>'hero_title_accent', 'value'=>'every occasion',                      'type'=>'text',     'label'=>'Hero Title (Accent)',  'group'=>'hero'],
            ['key'=>'hero_subtitle',     'value'=>'Bespoke suits, sherwanis and occasion wear — crafted to your measurements and personality.', 'type'=>'textarea', 'label'=>'Hero Subtitle', 'group'=>'hero'],
            ['key'=>'hero_cta',          'value'=>'View Collections',                    'type'=>'text',     'label'=>'Hero CTA Button Text', 'group'=>'hero'],
            ['key'=>'hero_image',        'value'=>null,                                  'type'=>'image',    'label'=>'Hero Background Image','group'=>'hero'],
            ['key'=>'featured_title',    'value'=>'The Collection',                      'type'=>'text',     'label'=>'Featured Section Title','group'=>'home'],
            ['key'=>'featured_tagline',  'value'=>'Curated for him',                     'type'=>'text',     'label'=>'Featured Tagline',     'group'=>'home'],
            ['key'=>'gallery_title',     'value'=>'Gallery',                             'type'=>'text',     'label'=>'Gallery Title',        'group'=>'home'],
            ['key'=>'craft_tagline',     'value'=>'Our Process',                         'type'=>'text',     'label'=>'Process Tagline',      'group'=>'home'],
            ['key'=>'craft_title',       'value'=>'Every garment made for you',          'type'=>'text',     'label'=>'Process Title',        'group'=>'home'],
            ['key'=>'craft_body',        'value'=>"We don't sell off the rack. Every piece is custom-fitted to your body and tailored to your occasion.", 'type'=>'textarea', 'label'=>'Process Body', 'group'=>'home'],
            ['key'=>'cta_title',         'value'=>'Ready for your perfect fit?',         'type'=>'text',     'label'=>'CTA Banner Title',     'group'=>'home'],
            ['key'=>'cta_body',          'value'=>'Send us a message on WhatsApp or call us directly. Tell us your occasion and style — we respond within hours.', 'type'=>'textarea', 'label'=>'CTA Banner Body', 'group'=>'home'],
            ['key'=>'about_tagline',     'value'=>'Designer menswear for every occasion — custom-fitted, handcrafted, made for you.', 'type'=>'textarea', 'label'=>'About Tagline (footer)', 'group'=>'general'],
            ['key'=>'store_hours',       'value'=>'Mon–Sat · 10am–7pm',                 'type'=>'text',     'label'=>'Store Hours',          'group'=>'general'],
        ];
        foreach ($settings as $s) {
            SiteSetting::updateOrCreate(['key' => $s['key']], $s);
        }
    }
}
