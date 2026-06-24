<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// ── Services ────────────────────────────────────────────────────────────────

// Apache: if this script is running, Apache is up
$apache = ['ok' => true, 'status' => 'Running'];

// PHP version
$php = ['ok' => true, 'version' => phpversion()];

// Proxy forwarder: check that forward.php exists and is readable
$forwarder_path = __DIR__ . '/forward.php';
$proxy_ok = file_exists($forwarder_path) && is_readable($forwarder_path);
$proxy = ['ok' => $proxy_ok, 'status' => $proxy_ok ? 'OK' : 'Missing'];

// Log files: check that the log directory is writable
$log_dir = __DIR__ . '/../logs';
if (!is_dir($log_dir)) $log_dir = sys_get_temp_dir();
$logs_ok = is_writable($log_dir);
$logs = ['ok' => $logs_ok];

// ── System resources ────────────────────────────────────────────────────────

// Disk
$disk_total  = disk_total_space('/');
$disk_free   = disk_free_space('/');
$disk_used   = $disk_total - $disk_free;
$disk_pct    = $disk_total > 0 ? ($disk_used / $disk_total) * 100 : 0;

// Memory (Linux /proc/meminfo)
$mem_total_mb     = 0;
$mem_available_mb = 0;
if (is_readable('/proc/meminfo')) {
    $meminfo = file_get_contents('/proc/meminfo');
    preg_match('/MemTotal:\s+(\d+)/', $meminfo, $m);
    $mem_total_kb = isset($m[1]) ? (int)$m[1] : 0;
    preg_match('/MemAvailable:\s+(\d+)/', $meminfo, $m);
    $mem_avail_kb = isset($m[1]) ? (int)$m[1] : 0;
    $mem_total_mb     = round($mem_total_kb / 1024);
    $mem_available_mb = round($mem_avail_kb / 1024);
}
$mem_used_pct = $mem_total_mb > 0
    ? (($mem_total_mb - $mem_available_mb) / $mem_total_mb) * 100
    : 0;

// CPU load
$load = sys_getloadavg();

// Uptime
$uptime_str = 'Unknown';
if (is_readable('/proc/uptime')) {
    $seconds = (int)explode(' ', file_get_contents('/proc/uptime'))[0];
    $days    = floor($seconds / 86400);
    $hours   = floor(($seconds % 86400) / 3600);
    $minutes = floor(($seconds % 3600) / 60);
    $uptime_str = $days > 0 ? "{$days}d {$hours}h" : "{$hours}h {$minutes}m";
}

// ── Recent proxy errors (last 20 lines of error log) ────────────────────────
$recent_errors = [];
$error_log_candidates = [
    __DIR__ . '/../logs/proxy_errors.log',
    __DIR__ . '/errors.log',
    ini_get('error_log'),
];
foreach ($error_log_candidates as $log_file) {
    if ($log_file && is_readable($log_file)) {
        $lines = file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $recent_errors = array_slice(array_reverse($lines), 0, 20);
        break;
    }
}

// ── Overall status ──────────────────────────────────────────────────────────
$overall = 'online';
if (!$proxy_ok || $disk_pct > 90 || $mem_used_pct > 90) $overall = 'degraded';

echo json_encode([
    'overall_status' => $overall,
    'services' => [
        'apache' => $apache,
        'php'    => $php,
        'proxy'  => $proxy,
        'logs'   => $logs,
    ],
    'system' => [
        'disk_total_gb'        => round($disk_total / 1073741824, 1),
        'disk_free_gb'         => round($disk_free  / 1073741824, 1),
        'disk_used_percent'    => round($disk_pct, 1),
        'memory_total_mb'      => $mem_total_mb,
        'memory_available_mb'  => $mem_available_mb,
        'memory_used_percent'  => round($mem_used_pct, 1),
        'load_1min'            => round($load[0], 2),
        'load_5min'            => round($load[1], 2),
        'load_15min'           => round($load[2], 2),
        'uptime'               => $uptime_str,
    ],
    'recent_errors' => $recent_errors,
], JSON_UNESCAPED_SLASHES);
