<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\Content\HomepageService;
use App\Services\Settings\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->settings->grouped()]);
    }

    public function update(Request $request, ActivityLogger $logger): JsonResponse
    {
        // Only keys present in the request are validated and saved (partial updates per settings tab).
        $rules = array_intersect_key($this->settings->rules(), $request->all() + ['brand_colors.*' => true]);
        $data = $request->validate($rules, [
            'whatsapp_business_number.regex' => 'Enter the number in international format, e.g. +919876543210 (country code, no spaces).',
            'ga4_measurement_id.regex' => 'GA4 measurement IDs look like G-XXXXXXXXXX.',
        ]);
        unset($data['brand_colors.*']);

        $before = array_intersect_key($this->settings->all(), $data);
        $this->settings->update($data);
        app(HomepageService::class)->flush();

        $changes = [];
        foreach ($data as $key => $value) {
            if (($before[$key] ?? null) !== $value) {
                $changes[$key] = ['from' => $before[$key] ?? null, 'to' => $value];
            }
        }
        $logger->log('settings.updated', 'Updated settings: '.implode(', ', array_keys($changes)), null, $changes ?: null);

        return $this->show();
    }
}
