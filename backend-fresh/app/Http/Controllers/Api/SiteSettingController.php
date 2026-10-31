<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SiteSettingController extends Controller {
    public function publicIndex() {
        $settings = SiteSetting::all()->keyBy('key')
            ->map(fn($s) => $s->value);
        return response()->json($settings);
    }

    public function index() {
        return response()->json(SiteSetting::all()->keyBy('key'));
    }

    public function update(Request $request) {
        foreach ($request->except('_method') as $key => $value) {
            if ($request->hasFile($key)) {
                $file = $request->file($key);
                $existing = SiteSetting::where('key', $key)->value('value');
                if ($existing) Storage::disk('public')->delete($existing);
                $path = $file->store('site', 'public');
                SiteSetting::set($key, $path);
            } elseif (is_string($value) || is_null($value)) {
                SiteSetting::set($key, $value);
            }
        }
        return response()->json(SiteSetting::all()->keyBy('key'));
    }
}
