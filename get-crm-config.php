<?php
header('Content-Type: application/json');
header('Cache-Control: no-cache');
$config = @json_decode(@file_get_contents(__DIR__ . '/data/crm-config.json'), true);
echo json_encode(['crmName' => $config['crmName'] ?? 'CRM']);
