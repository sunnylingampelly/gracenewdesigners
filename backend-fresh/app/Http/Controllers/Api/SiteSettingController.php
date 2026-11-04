<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SiteSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SiteSettingController extends Controller {
    public function publicIndex() {
        // Returns flat {key: value} map for use on public pages
        return response()->json(
            SiteSetting::all()->keyBy('key')->map(fn($s) => $s->value)
        );
    }

    public function index() {
        // Returns array of full setting objects so admin UI knows type/label/group
        return response()->json(['data' => SiteSetting::orderBy('group')->orderBy('id')->get()]);
    }

    public function update(Request $request) {
        // Support nested format: settings[key]=value (from FormData)
        $isNested = $request->has('settings');
        $settings  = $isNested ? $request->input('settings', []) : $request->except('_method');
        $fileMap   = $isNested ? ($request->file('settings', [])) : $request->allFiles();

        foreach ($settings as $key => $value) {
            $file = $fileMap[$key] ?? null;
            if ($file && $file->isValid()) {
                $existing = SiteSetting::where('key', $key)->value('value');
                if ($existing) Storage::disk('public')->delete($existing);
                SiteSetting::set($key, $file->store('site', 'public'));
            } elseif ($value === '' || is_null($value)) {
                SiteSetting::set($key, null);
            } elseif (is_string($value)) {
                SiteSetting::set($key, $value);
            }
        }

        return response()->json(['data' => SiteSetting::orderBy('group')->orderBy('id')->get()]);
    }
}
