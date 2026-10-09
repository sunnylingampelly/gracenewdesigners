<?php

namespace App\Services\Settings;

use App\Models\MediaAsset;
use App\Models\Setting;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;

/**
 * Typed, admin-managed site settings. Unknown real-world business details (logo, WhatsApp number,
 * domain, address) default to null and must be configured from the admin panel.
 */
class SettingsService
{
    private const CACHE_KEY = 'settings.all.v1';

    /**
     * key => [group, validation rules, default, public?]
     */
    public const DEFINITIONS = [
        // Brand
        'brand_name' => ['brand', ['required', 'string', 'max:120'], 'Grace New Designers', true],
        'tagline' => ['brand', ['nullable', 'string', 'max:160'], 'Premium Menswear, Timeless Style.', true],
        'brand_description' => ['brand', ['nullable', 'string', 'max:2000'], null, true],
        'logo_primary_media_id' => ['brand', ['nullable', 'integer', 'exists:media_assets,id'], null, true],
        'logo_dark_bg_media_id' => ['brand', ['nullable', 'integer', 'exists:media_assets,id'], null, true],
        'logo_light_bg_media_id' => ['brand', ['nullable', 'integer', 'exists:media_assets,id'], null, true],
        'logo_mobile_media_id' => ['brand', ['nullable', 'integer', 'exists:media_assets,id'], null, true],
        'favicon_media_id' => ['brand', ['nullable', 'integer', 'exists:media_assets,id'], null, true],
        'social_share_media_id' => ['brand', ['nullable', 'integer', 'exists:media_assets,id'], null, true],
        'brand_colors' => ['brand', ['nullable', 'array'], null, true],
        'brand_colors.*' => ['brand', ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'], null, false],

        // Contact
        'contact_email' => ['contact', ['nullable', 'email', 'max:190'], null, true],
        'contact_phone' => ['contact', ['nullable', 'string', 'max:40'], null, true],
        'address' => ['contact', ['nullable', 'string', 'max:500'], null, true],
        'business_hours' => ['contact', ['nullable', 'string', 'max:300'], null, true],
        'map_url' => ['contact', ['nullable', 'url', 'max:500'], null, true],

        // WhatsApp commerce
        'whatsapp_business_number' => ['whatsapp', ['nullable', 'string', 'regex:/^\+[1-9]\d{7,14}$/'], null, true],
        'whatsapp_enabled' => ['whatsapp', ['boolean'], true, true],
        'whatsapp_closing_line' => ['whatsapp', ['nullable', 'string', 'max:300'],
            'Could you please confirm availability, delivery details, and how to place the order?', false],

        // Social
        'social_instagram' => ['social', ['nullable', 'url', 'max:300'], null, true],
        'social_facebook' => ['social', ['nullable', 'url', 'max:300'], null, true],
        'social_pinterest' => ['social', ['nullable', 'url', 'max:300'], null, true],
        'social_youtube' => ['social', ['nullable', 'url', 'max:300'], null, true],
        'social_x' => ['social', ['nullable', 'url', 'max:300'], null, true],

        // Storefront
        'site_url' => ['store', ['nullable', 'url', 'max:300'], null, true],
        'currency' => ['store', ['required', 'string', 'size:3'], 'INR', true],
        'timezone' => ['store', ['required', 'timezone'], 'Asia/Kolkata', true],
        'announcement_enabled' => ['store', ['boolean'], false, true],
        'announcement_text' => ['store', ['nullable', 'string', 'max:200'], null, true],
        'announcement_link' => ['store', ['nullable', 'string', 'max:300'], null, true],
        'newsletter_enabled' => ['store', ['boolean'], true, true],
        'consultation_enabled' => ['store', ['boolean'], true, true],
        'shipping_note' => ['store', ['nullable', 'string', 'max:1000'], null, true],

        // SEO & marketing
        'seo_title_suffix' => ['seo', ['nullable', 'string', 'max:80'], 'Grace New Designers', true],
        'seo_default_description' => ['seo', ['nullable', 'string', 'max:300'],
            'Premium menswear — wedding attire, formal wear and luxury ethnic clothing for men by Grace New Designers.', true],
        'google_site_verification' => ['seo', ['nullable', 'string', 'max:120'], null, true],
        'ga4_measurement_id' => ['seo', ['nullable', 'string', 'regex:/^G-[A-Z0-9]{4,20}$/'], null, true],

        // Privacy & operations
        'enquiry_retention_months' => ['privacy', ['required', 'integer', 'min:1', 'max:120'], 24, false],
        'analytics_retention_days' => ['privacy', ['required', 'integer', 'min:7', 'max:1095'], 395, false],
        'notify_new_enquiry_email' => ['notifications', ['nullable', 'email'], null, false],
        'notify_low_stock' => ['notifications', ['boolean'], false, false],
    ];

    /** @return array<string, mixed> */
    public function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $stored = Setting::query()->pluck('value', 'key')->all();
            $values = [];
            foreach (self::DEFINITIONS as $key => [, , $default]) {
                if (str_contains($key, '*')) {
                    continue;
                }
                $values[$key] = array_key_exists($key, $stored) ? $stored[$key] : $default;
            }

            return $values;
        });
    }

    public function get(string $key, mixed $fallback = null): mixed
    {
        return $this->all()[$key] ?? $fallback;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return array_map(fn ($definition) => $definition[1], self::DEFINITIONS);
    }

    /** @param array<string, mixed> $values */
    public function update(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! isset(self::DEFINITIONS[$key]) || str_contains($key, '*')) {
                continue;
            }
            [$group, , , $public] = self::DEFINITIONS[$key];
            Setting::query()->updateOrCreate(['key' => $key], ['group' => $group, 'value' => $value, 'is_public' => $public]);
        }
        $this->flush();
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** Settings grouped for the admin UI. */
    public function grouped(): array
    {
        $values = $this->all();
        $groups = [];
        foreach (self::DEFINITIONS as $key => [$group]) {
            if (! str_contains($key, '*')) {
                $groups[$group][$key] = $values[$key];
            }
        }

        return $groups;
    }

    /** Public settings, with media references expanded to URLs. */
    public function publicSettings(): array
    {
        $values = Arr::where($this->all(), fn ($v, $key) => self::DEFINITIONS[$key][3] === true);

        $mediaKeys = array_filter(array_keys($values), fn ($key) => str_ends_with($key, '_media_id'));
        $mediaIds = array_filter(array_map(fn ($key) => $values[$key], $mediaKeys));
        $media = $mediaIds ? MediaAsset::query()->whereIn('id', $mediaIds)->get()->keyBy('id') : collect();

        foreach ($mediaKeys as $key) {
            $asset = $media->get($values[$key]);
            $values[str_replace('_media_id', '', $key)] = $asset?->toPublicArray();
            unset($values[$key]);
        }

        $values['whatsapp_available'] = (bool) $values['whatsapp_enabled'] && filled($values['whatsapp_business_number']);

        return $values;
    }

    public function siteUrl(): string
    {
        return rtrim($this->get('site_url') ?: config('app.frontend_url'), '/');
    }
}
