<?php

namespace App\Console\Commands;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Services\ActivityLogger;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Scheduled products are already visible once their publish time passes (see Product::scopePubliclyVisible);
 * this command records the transition so admin listings and audit logs reflect it.
 */
#[Signature('catalog:publish-scheduled')]
#[Description('Mark scheduled products whose publish time has passed as published')]
class PublishScheduledProducts extends Command
{
    public function handle(ActivityLogger $logger): int
    {
        $due = Product::query()->where('status', ProductStatus::Scheduled->value)->where('published_at', '<=', now())->get();
        foreach ($due as $product) {
            $product->update(['status' => ProductStatus::Published]);
            $logger->log('product.auto_published', "Scheduled product {$product->name} went live", $product);
        }
        $this->info("Published {$due->count()} scheduled product(s).");

        return self::SUCCESS;
    }
}
