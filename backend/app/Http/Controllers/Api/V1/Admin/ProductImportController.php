<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessProductImport;
use App\Models\Product;
use App\Models\ProductImport;
use App\Services\ActivityLogger;
use App\Services\Catalog\ProductCsvService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductImportController extends Controller
{
    public function __construct(private readonly ProductCsvService $csv) {}

    public function export(Request $request): StreamedResponse
    {
        $this->authorize('export', Product::class);
        $ids = $request->validate(['ids' => ['nullable', 'array'], 'ids.*' => ['integer']])['ids'] ?? null;
        app(ActivityLogger::class)->log('product.exported', 'Exported products to CSV');

        return $this->stream('products-'.now()->format('Y-m-d-His').'.csv', $this->csv->exportRows($ids));
    }

    public function template(): StreamedResponse
    {
        $this->authorize('import', Product::class);

        return $this->stream('product-import-template.csv', $this->csv->templateRows());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('import', Product::class);
        $data = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimetypes:text/csv,text/plain,application/csv,application/vnd.ms-excel'],
            'dry_run' => ['required', 'boolean'],
        ]);

        $path = $data['file']->storeAs('imports', now()->format('Ymd-His').'-'.bin2hex(random_bytes(4)).'.csv', 'local');
        $import = ProductImport::query()->create([
            'user_id' => $request->user()->id,
            'original_name' => mb_substr($data['file']->getClientOriginalName(), 0, 250),
            'path' => $path,
            'dry_run' => (bool) $data['dry_run'],
            'status' => 'queued',
        ]);
        ProcessProductImport::dispatch($import->id);

        return response()->json(['data' => $this->present($import->fresh())], 202);
    }

    /** Re-run a validated dry run for real, using the same uploaded file. */
    public function commit(ProductImport $import): JsonResponse
    {
        $this->authorize('import', Product::class);
        abort_unless($import->dry_run && $import->status === 'completed', 422, 'Only a completed dry run can be committed.');

        $real = ProductImport::query()->create([
            'user_id' => auth()->id(),
            'original_name' => $import->original_name,
            'path' => $import->path,
            'dry_run' => false,
            'status' => 'queued',
        ]);
        ProcessProductImport::dispatch($real->id);

        return response()->json(['data' => $this->present($real->fresh())], 202);
    }

    public function show(ProductImport $import): JsonResponse
    {
        $this->authorize('import', Product::class);

        return response()->json(['data' => $this->present($import)]);
    }

    public function index(): JsonResponse
    {
        $this->authorize('import', Product::class);

        return response()->json(['data' => ProductImport::query()->with('user:id,name')->latest('id')->limit(20)->get()
            ->map(fn ($i) => $this->present($i))]);
    }

    private function present(ProductImport $import): array
    {
        return [
            'id' => $import->id,
            'original_name' => $import->original_name,
            'dry_run' => $import->dry_run,
            'status' => $import->status,
            'total_rows' => $import->total_rows,
            'created_count' => $import->created_count,
            'updated_count' => $import->updated_count,
            'skipped_count' => $import->skipped_count,
            'error_count' => $import->error_count,
            'row_errors' => $import->row_errors ?? [],
            'preview' => $import->preview ?? [],
            'user' => $import->relationLoaded('user') ? $import->user?->name : null,
            'created_at' => $import->created_at?->toIso8601String(),
            'finished_at' => $import->finished_at?->toIso8601String(),
        ];
    }

    private function stream(string $filename, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so spreadsheet apps detect the encoding
            fputcsv($out, ProductCsvService::COLUMNS, escape: '\\');
            foreach ($rows as $row) {
                fputcsv($out, array_map(fn ($c) => $this->neutralize($row[$c] ?? ''), ProductCsvService::COLUMNS), escape: '\\');
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Prevent CSV formula injection when the export is opened in a spreadsheet. */
    private function neutralize(mixed $value): string
    {
        $value = (string) $value;

        return $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true) && ! is_numeric($value) ? "'".$value : $value;
    }
}
