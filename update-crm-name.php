<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://backend.marketlinkco.live');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$secret = 'd51f2760280571840e7826615a3ecb8a56bbdb159c07e99a';

if (!$input || ($input['secret'] ?? '') !== $secret) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

$crmName = trim($input['crmName'] ?? '');
if ($crmName === '') {
    http_response_code(400);
    echo json_encode(['error' => 'crmName required']);
    exit;
}

$result = file_put_contents(__DIR__ . '/data/crm-config.json', json_encode(['crmName' => $crmName]));
if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'write failed']);
    exit;
}
echo json_encode(['ok' => true]);
