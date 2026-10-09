<?php

return [
    // Filesystem disk for uploads: "public" locally, "s3" (or any S3-compatible store) in production.
    'disk' => env('MEDIA_DISK', 'public'),

    // AVIF renditions are smaller but slow to encode with GD; enable when workers have headroom.
    'avif' => (bool) env('MEDIA_AVIF', false),
];
