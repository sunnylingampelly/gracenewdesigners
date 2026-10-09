<?php

namespace App\Services\Search;

use Illuminate\Database\Eloquent\Builder;

/**
 * Replaceable search backend. The default implementation uses indexed database queries;
 * a Meilisearch/OpenSearch engine can be bound in AppServiceProvider without touching callers.
 */
interface SearchEngine
{
    /**
     * Constrain a product query to records matching the search term and apply relevance ordering
     * when $orderByRelevance is true.
     */
    public function constrain(Builder $query, string $term, bool $orderByRelevance = true): Builder;

    /** Return a corrected query when the original term looks misspelt, or null. */
    public function suggestCorrection(string $term): ?string;
}
