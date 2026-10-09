<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Asks the Next.js storefront to refresh its cached (ISR) pages after admin changes, so a publish
 * is visible immediately instead of after the revalidation window. Fire-and-forget, after the response.
 */
class StorefrontRevalidator
{
    private bool $scheduled = false;

    public function revalidate(): void
    {
        $url = config('services.storefront.revalidate_url');
        $secret = config('services.storefront.revalidate_secret');
        if (! $url || ! $secret || $this->scheduled || app()->runningUnitTests()) {
            return;
        }
        $this->scheduled = true; // one call per request, however many models changed

        dispatch(function () use ($url, $secret) {
            try {
                Http::timeout(3)->withHeaders(['x-revalidate-secret' => $secret])->post($url, ['tags' => ['catalog']]);
            } catch (Throwable $e) {
                Log::warning('Storefront revalidation failed: '.$e->getMessage());
            }
        })->afterResponse();
    }
}
