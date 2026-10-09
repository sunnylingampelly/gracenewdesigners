<?php

namespace App\Jobs;

use App\Models\ProductImport;
use App\Services\Catalog\ProductCsvService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessProductImport implements ShouldQueue
{
    use Queueable;

    public int $timeout = 900;

    public int $tries = 1;

    public function __construct(public int $importId) {}

    public function handle(ProductCsvService $csv): void
    {
        $import = ProductImport::query()->find($this->importId);
        if ($import && in_array($import->status, ['queued', 'processing'], true)) {
            $csv->run($import);
        }
    }
}
