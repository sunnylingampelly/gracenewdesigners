<?php

namespace App\Services\Search;

use App\Models\Category;
use App\Models\Collection;
use App\Models\Occasion;
use App\Models\Product;
use App\Models\ProductOptionValue;
use App\Models\Tag;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * MySQL FULLTEXT (boolean mode, prefix matching) over products.name + products.search_text.
 * On other drivers (SQLite for local tests) falls back to token-wise prefix LIKE on the
 * same two columns only. Typo tolerance uses a small cached vocabulary and Levenshtein distance.
 */
class DatabaseSearchEngine implements SearchEngine
{
    private const VOCABULARY_CACHE = 'search.vocabulary.v1';

    public function constrain(Builder $query, string $term, bool $orderByRelevance = true): Builder
    {
        $tokens = $this->tokens($term);
        if ($tokens === []) {
            return $query;
        }

        // InnoDB ignores tokens shorter than innodb_ft_min_token_size (3 by default).
        $fulltextTokens = array_values(array_filter($tokens, fn ($t) => mb_strlen($t) >= 3));
        if (DB::connection()->getDriverName() === 'mysql' && $fulltextTokens !== []) {
            $boolean = collect($fulltextTokens)->map(fn ($t) => '+'.$t.'*')->implode(' ');
            $query->whereRaw('MATCH(products.name, products.search_text) AGAINST (? IN BOOLEAN MODE)', [$boolean]);
            if ($orderByRelevance) {
                $query->orderByRaw('MATCH(products.name, products.search_text) AGAINST (? IN BOOLEAN MODE) DESC', [$boolean]);
            }

            return $query;
        }

        foreach ($tokens as $token) {
            $like = '%'.$this->escapeLike($token).'%';
            $query->where(fn ($q) => $q->where('products.name', 'like', $like)
                ->orWhere('products.search_text', 'like', $like)
                ->orWhere('products.sku', 'like', $this->escapeLike(Str::upper($token)).'%'));
        }
        if ($orderByRelevance) {
            $first = $this->escapeLike($tokens[0]);
            $query->orderByRaw('CASE WHEN products.name LIKE ? THEN 0 ELSE 1 END', [$first.'%']);
        }

        return $query;
    }

    public function suggestCorrection(string $term): ?string
    {
        $tokens = $this->tokens($term);
        if ($tokens === []) {
            return null;
        }
        $vocabulary = $this->vocabulary();
        $changed = false;

        $corrected = array_map(function (string $token) use ($vocabulary, &$changed) {
            if (in_array($token, $vocabulary, true) || mb_strlen($token) < 4) {
                return $token;
            }
            $best = null;
            $bestDistance = PHP_INT_MAX;
            $maxDistance = mb_strlen($token) >= 7 ? 2 : 1;
            foreach ($vocabulary as $word) {
                if (abs(strlen($word) - strlen($token)) > $maxDistance) {
                    continue;
                }
                $distance = levenshtein($token, $word);
                if ($distance < $bestDistance) {
                    [$best, $bestDistance] = [$word, $distance];
                }
            }
            if ($best !== null && $bestDistance <= $maxDistance) {
                $changed = true;

                return $best;
            }

            return $token;
        }, $tokens);

        return $changed ? implode(' ', $corrected) : null;
    }

    /** @return list<string> */
    private function tokens(string $term): array
    {
        $clean = Str::of($term)->lower()->replaceMatches('/[^\p{L}\p{N}\s-]+/u', ' ')->squish()->toString();

        return array_values(array_filter(explode(' ', $clean), fn ($t) => mb_strlen($t) >= 2));
    }

    /** @return list<string> */
    private function vocabulary(): array
    {
        return Cache::remember(self::VOCABULARY_CACHE, now()->addHour(), function () {
            $phrases = collect()
                ->merge(Product::query()->publiclyVisible()->pluck('name'))
                ->merge(Category::query()->published()->pluck('name'))
                ->merge(Collection::query()->visible()->pluck('name'))
                ->merge(Occasion::query()->where('is_published', true)->pluck('name'))
                ->merge(Tag::query()->pluck('name'))
                ->merge(ProductOptionValue::query()->pluck('label'));

            return $phrases->flatMap(fn ($p) => $this->tokens((string) $p))->unique()->values()->all();
        });
    }

    public static function flushVocabulary(): void
    {
        Cache::forget(self::VOCABULARY_CACHE);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }
}
